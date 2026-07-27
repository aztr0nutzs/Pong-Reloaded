package com.example

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [36])
class ApplicationConfigurationTest {
  @Test
  fun applicationUsesApprovedProductName() {
    val context = ApplicationProvider.getApplicationContext<Context>()

    assertEquals("Cyber Pong", context.getString(R.string.app_name))
  }
}
