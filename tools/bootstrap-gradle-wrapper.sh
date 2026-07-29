#!/usr/bin/env bash

set -euo pipefail

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
readonly WRAPPER_PROPERTIES="${REPO_ROOT}/gradle/wrapper/gradle-wrapper.properties"
readonly WRAPPER_JAR="${REPO_ROOT}/gradle/wrapper/gradle-wrapper.jar"

fail() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

command -v unzip >/dev/null 2>&1 || fail "unzip is required to extract the official Gradle distribution."

if command -v sha256sum >/dev/null 2>&1; then
  checksum_file() {
    sha256sum "$1" | awk '{ print $1 }'
  }
elif command -v shasum >/dev/null 2>&1; then
  checksum_file() {
    shasum -a 256 "$1" | awk '{ print $1 }'
  }
else
  fail "sha256sum or shasum is required to verify the Gradle distribution."
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
  fail "curl or wget is required to download the official Gradle distribution."
fi

[[ -f "${WRAPPER_PROPERTIES}" ]] || fail "Missing ${WRAPPER_PROPERTIES}."

raw_distribution_url="$(sed -n 's/^distributionUrl=//p' "${WRAPPER_PROPERTIES}")"
[[ -n "${raw_distribution_url}" ]] || fail "distributionUrl is missing from ${WRAPPER_PROPERTIES}."
distribution_url="${raw_distribution_url//\\:/:}"

if [[ ! "${distribution_url}" =~ ^https://services\.gradle\.org/distributions/gradle-([0-9][0-9A-Za-z.-]*)-bin\.zip$ ]]; then
  fail "distributionUrl must be an official services.gradle.org Gradle binary distribution: ${distribution_url}"
fi

readonly GRADLE_VERSION="${BASH_REMATCH[1]}"
readonly DISTRIBUTION_URL="${distribution_url}"
readonly CHECKSUM_URL="${DISTRIBUTION_URL}.sha256"

temp_dir="$(mktemp -d)" || fail "Unable to create a temporary directory."
cleanup() {
  rm -rf -- "${temp_dir}"
}
trap cleanup EXIT

readonly DISTRIBUTION_ZIP="${temp_dir}/gradle-${GRADLE_VERSION}-bin.zip"
readonly CHECKSUM_FILE="${temp_dir}/gradle-${GRADLE_VERSION}-bin.zip.sha256"

printf 'Downloading official Gradle %s distribution from %s\n' "${GRADLE_VERSION}" "${DISTRIBUTION_URL}"
download "${DISTRIBUTION_URL}" "${DISTRIBUTION_ZIP}" || fail "Failed to download ${DISTRIBUTION_URL}."
download "${CHECKSUM_URL}" "${CHECKSUM_FILE}" || fail "Failed to download the official checksum from ${CHECKSUM_URL}."

expected_checksum="$(awk 'NR == 1 { print $1 }' "${CHECKSUM_FILE}")"
[[ "${expected_checksum}" =~ ^[0-9a-fA-F]{64}$ ]] || fail "Official checksum response is not a valid SHA-256 value."
actual_checksum="$(checksum_file "${DISTRIBUTION_ZIP}")"

if [[ "${actual_checksum,,}" != "${expected_checksum,,}" ]]; then
  fail "Gradle distribution checksum mismatch: expected ${expected_checksum}, got ${actual_checksum}."
fi
printf 'Verified Gradle distribution SHA-256: %s\n' "${expected_checksum,,}"

if ! unzip -q "${DISTRIBUTION_ZIP}" -d "${temp_dir}"; then
  fail "Failed to extract the verified Gradle distribution."
fi

gradle_executable="${temp_dir}/gradle-${GRADLE_VERSION}/bin/gradle"
[[ -x "${gradle_executable}" ]] || fail "Verified distribution does not contain the expected Gradle executable."

printf 'Generating the official Gradle %s wrapper files.\n' "${GRADLE_VERSION}"
if ! (cd -- "${REPO_ROOT}" && "${gradle_executable}" --no-daemon wrapper --gradle-version "${GRADLE_VERSION}" --distribution-type bin); then
  fail "Gradle wrapper generation failed."
fi

[[ -f "${WRAPPER_JAR}" ]] || fail "Gradle completed without generating ${WRAPPER_JAR}."

printf 'Validating the generated repository wrapper.\n'
if ! (cd -- "${REPO_ROOT}" && ./gradlew --version); then
  fail "Generated wrapper validation failed."
fi

printf 'Gradle wrapper bootstrap completed. The generated JAR is local and ignored by Git.\n'
