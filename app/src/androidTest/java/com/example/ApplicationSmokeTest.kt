package com.example

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class ApplicationSmokeTest {
  @Test
  fun packagedApplicationHasExpectedIdentityAndGameAsset() {
    val appContext = InstrumentationRegistry.getInstrumentation().targetContext

    assertEquals("com.aistudio.cyberpong.lxmpt", appContext.packageName)
    assertEquals("Cyber Pong", appContext.getString(R.string.app_name))
    appContext.assets.open("index.html").bufferedReader().use { reader ->
      assertTrue(reader.readText().contains("js/modules/Main.js"))
    }
  }
}
