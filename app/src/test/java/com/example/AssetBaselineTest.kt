package com.example

import java.io.File
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class AssetBaselineTest {
  private val assetsDirectory = File("src/main/assets")

  @Test
  fun gamePageLoadsTheProductionModulesInDependencyOrder() {
    val index = File(assetsDirectory, "index.html").readText()
    val moduleSources =
      Regex("""<script src="(js/modules/[^"]+\.js)"></script>""")
        .findAll(index)
        .map { it.groupValues[1] }
        .toList()

    assertEquals(
      listOf(
        "js/modules/GameStateManager.js",
        "js/modules/Util.js",
        "js/modules/AudioController.js",
        "js/modules/EffectsManager.js",
        "js/modules/CupManager.js",
        "js/modules/BallController.js",
        "js/modules/UIRenderer.js",
        "js/modules/Renderer.js",
        "js/modules/CameraController.js",
        "js/modules/PhysicsEngine.js",
        "js/modules/TrajectoryPredictor.js",
        "js/modules/InputManager.js",
        "js/modules/ThrowController.js",
        "js/modules/AIController.js",
        "js/modules/Main.js",
      ),
      moduleSources,
    )
    moduleSources.forEach { source ->
      assertTrue("Missing game module: $source", File(assetsDirectory, source).isFile)
    }
  }

  @Test
  fun gamePageRetainsRequiredNavigationAndGameplayControls() {
    val index = File(assetsDirectory, "index.html").readText()
    val requiredIds =
      listOf(
        "screen-boot",
        "screen-menu",
        "screen-game",
        "btn-quick-match",
        "btn-ranked",
        "btn-tournament",
        "btn-open-drawer",
        "btn-open-settings-game",
        "btn-pause",
        "btn-trick-shot",
        "table-surface",
        "ball",
      )

    requiredIds.forEach { id ->
      assertTrue("Missing required UI/game element: $id", index.contains("id=\"$id\""))
    }
  }
}
