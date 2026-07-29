#!/usr/bin/env bash

set -euo pipefail

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
readonly APP_BUILD_FILE="${REPO_ROOT}/app/build.gradle.kts"
readonly COMMAND_LINE_TOOLS_ARCHIVE="commandlinetools-linux-15859902_latest.zip"
readonly COMMAND_LINE_TOOLS_URL="https://dl.google.com/android/repository/${COMMAND_LINE_TOOLS_ARCHIVE}"
readonly COMMAND_LINE_TOOLS_SHA256="4e4c464f145a7512b57d088ac6c278c03c9eea610886b35a5e0804e74eedf583"
readonly BUILD_TOOLS_PACKAGE="build-tools;36.0.0"
readonly MINIMUM_FREE_KB=2097152

fail() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

for command_name in awk df grep mktemp realpath sed unzip yes; do
  command -v "${command_name}" >/dev/null 2>&1 || fail "${command_name} is required to bootstrap the Android SDK."
done

if command -v sha256sum >/dev/null 2>&1; then
  checksum_file() {
    sha256sum "$1" | awk '{ print $1 }'
  }
elif command -v shasum >/dev/null 2>&1; then
  checksum_file() {
    shasum -a 256 "$1" | awk '{ print $1 }'
  }
else
  fail "sha256sum or shasum is required to verify the Android command-line tools archive."
fi

if command -v curl >/dev/null 2>&1; then
  download() {
    curl --fail --location --proto '=https' --tlsv1.2 --retry 3 --silent --show-error --output "$2" "$1"
  }
elif command -v wget >/dev/null 2>&1; then
  download() {
    wget --https-only --tries=3 --quiet --output-document="$2" "$1"
  }
else
  fail "curl or wget is required to download the official Android command-line tools."
fi

[[ "${COMMAND_LINE_TOOLS_URL}" =~ ^https://dl\.google\.com/android/repository/[A-Za-z0-9._-]+\.zip$ ]] ||
  fail "Pinned Android command-line tools URL is not an approved Google repository URL."
[[ -f "${APP_BUILD_FILE}" ]] || fail "Missing ${APP_BUILD_FILE}."

compile_sdk="$(sed -nE 's/.*compileSdk.*release\(([0-9]+)\).*/\1/p' "${APP_BUILD_FILE}" | head -n 1)"
minor_api="$(sed -nE 's/.*minorApiLevel[[:space:]]*=[[:space:]]*([0-9]+).*/\1/p' "${APP_BUILD_FILE}" | head -n 1)"
[[ "${compile_sdk}" =~ ^[0-9]+$ ]] || fail "Unable to determine compileSdk from ${APP_BUILD_FILE}."

platform_version="${compile_sdk}"
if [[ -n "${minor_api}" ]]; then
  [[ "${minor_api}" =~ ^[0-9]+$ ]] || fail "Invalid compile SDK minorApiLevel in ${APP_BUILD_FILE}."
  platform_version="${compile_sdk}.${minor_api}"
fi
readonly PLATFORM_PACKAGE="platforms;android-${platform_version}"
readonly PLATFORM_TOOLS_PACKAGE="platform-tools"

requested_sdk_root="${1:-${HOME:-}/android-sdk}"
[[ -n "${requested_sdk_root}" ]] || fail "Android SDK installation path must not be empty."
[[ "${requested_sdk_root}" == /* ]] || fail "Android SDK installation path must be absolute."

sdk_root="$(realpath -m -- "${requested_sdk_root}")"
case "${sdk_root}" in
  /|/bin|/boot|/dev|/etc|/lib|/lib64|/opt|/proc|/root|/run|/sbin|/sys|/usr|/var)
    fail "Refusing unsafe Android SDK installation path: ${sdk_root}"
    ;;
esac
if [[ "${sdk_root}" == "${REPO_ROOT}" || "${sdk_root}" == "${REPO_ROOT}/"* ]]; then
  fail "Android SDK installation path must be outside the repository: ${sdk_root}"
fi

mkdir -p -- "${sdk_root}" || fail "Unable to create Android SDK directory: ${sdk_root}"
[[ -w "${sdk_root}" ]] || fail "Android SDK directory is not writable: ${sdk_root}"

available_kb="$(df -Pk "${sdk_root}" | awk 'NR == 2 { print $4 }')"
[[ "${available_kb}" =~ ^[0-9]+$ ]] || fail "Unable to determine available disk space for ${sdk_root}."
if ((available_kb < MINIMUM_FREE_KB)); then
  fail "Insufficient disk space: at least ${MINIMUM_FREE_KB} KiB is required, ${available_kb} KiB is available."
fi

temp_dir="$(mktemp -d)" || fail "Unable to create a temporary directory."
cleanup() {
  rm -rf -- "${temp_dir}"
}
trap cleanup EXIT

archive_path="${temp_dir}/${COMMAND_LINE_TOOLS_ARCHIVE}"
printf 'Downloading pinned Android command-line tools from %s\n' "${COMMAND_LINE_TOOLS_URL}"
download "${COMMAND_LINE_TOOLS_URL}" "${archive_path}" || fail "Android command-line tools download failed."

actual_checksum="$(checksum_file "${archive_path}")"
if [[ "${actual_checksum,,}" != "${COMMAND_LINE_TOOLS_SHA256}" ]]; then
  fail "Android command-line tools checksum mismatch: expected ${COMMAND_LINE_TOOLS_SHA256}, got ${actual_checksum}."
fi
printf 'Verified Android command-line tools SHA-256: %s\n' "${COMMAND_LINE_TOOLS_SHA256}"

extract_dir="${temp_dir}/extracted"
mkdir -p -- "${extract_dir}"
unzip -q "${archive_path}" -d "${extract_dir}" || fail "Android command-line tools extraction failed."
[[ -x "${extract_dir}/cmdline-tools/bin/sdkmanager" ]] || fail "Extracted archive does not contain cmdline-tools/bin/sdkmanager."

mkdir -p -- "${sdk_root}/cmdline-tools"
rm -rf -- "${sdk_root}/cmdline-tools/latest"
mv -- "${extract_dir}/cmdline-tools" "${sdk_root}/cmdline-tools/latest" || fail "Unable to install Android command-line tools."

sdkmanager="${sdk_root}/cmdline-tools/latest/bin/sdkmanager"
[[ -x "${sdkmanager}" ]] || fail "sdkmanager is missing after command-line tools installation."

export ANDROID_HOME="${sdk_root}"
export ANDROID_SDK_ROOT="${sdk_root}"
export PATH="${sdk_root}/platform-tools:${sdk_root}/cmdline-tools/latest/bin:${PATH}"

printf '\nListing official Android SDK packages before installation.\n'
"${sdkmanager}" --sdk_root="${sdk_root}" --list || fail "sdkmanager --list failed."

printf '\nAndroid SDK licenses must be accepted to install the required packages.\n'
printf 'The following output is produced by the official Google sdkmanager license flow.\n'
set +o pipefail
yes | "${sdkmanager}" --sdk_root="${sdk_root}" --licenses
license_status="${PIPESTATUS[1]}"
set -o pipefail
[[ "${license_status}" -eq 0 ]] || fail "Android SDK license acceptance failed or was rejected."

required_packages=("${PLATFORM_TOOLS_PACKAGE}" "${PLATFORM_PACKAGE}" "${BUILD_TOOLS_PACKAGE}")
printf '\nInstalling required packages:\n'
printf '  %s\n' "${required_packages[@]}"
"${sdkmanager}" --sdk_root="${sdk_root}" "${required_packages[@]}" || fail "Required Android SDK package installation failed."

installed_packages="${temp_dir}/installed-packages.txt"
"${sdkmanager}" --sdk_root="${sdk_root}" --list_installed | tee "${installed_packages}" || fail "Unable to list installed Android SDK packages."
for package_name in "${required_packages[@]}"; do
  grep -Fq "${package_name}" "${installed_packages}" || fail "Required package was not installed: ${package_name}"
done

[[ -x "${sdk_root}/platform-tools/adb" ]] || fail "adb is missing after platform-tools installation."
[[ -d "${sdk_root}/platforms/android-${platform_version}" ]] || fail "Installed platform directory is missing for ${PLATFORM_PACKAGE}."
[[ -d "${sdk_root}/build-tools/36.0.0" ]] || fail "Installed build-tools directory is missing for ${BUILD_TOOLS_PACKAGE}."

printf '\nAndroid SDK bootstrap completed successfully.\n'
printf 'Run these commands in the current shell before building:\n'
printf 'export ANDROID_HOME=%q\n' "${sdk_root}"
printf 'export ANDROID_SDK_ROOT="$ANDROID_HOME"\n'
printf 'export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"\n'
printf './gradlew testDebugUnitTest --stacktrace\n'
printf './gradlew assembleDebug --stacktrace\n'
