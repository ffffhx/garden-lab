import java.util.Properties

plugins { id("com.android.application") }

val signing = Properties().apply {
    val config = rootProject.file("keystore.properties")
    if (config.exists()) config.inputStream().use { load(it) }
}

android {
    namespace = "com.gardenlab.online"
    compileSdk = 37
    defaultConfig {
        applicationId = "com.gardenlab.online"
        minSdk = 26
        targetSdk = 37
        versionCode = 4
        versionName = "0.3.2"
        buildConfigField("String", "UPDATE_URL", "\"https://ffffhx.github.io/garden-lab/android/update.json\"")
    }
    signingConfigs {
        if (signing.isNotEmpty()) create("release") {
            storeFile = file(signing.getProperty("storeFile"))
            storePassword = signing.getProperty("storePassword")
            keyAlias = signing.getProperty("keyAlias")
            keyPassword = signing.getProperty("keyPassword")
        }
    }
    buildTypes {
        release { signingConfig = signingConfigs.findByName("release") }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    buildFeatures { buildConfig = true }
}

dependencies {
    implementation("androidx.core:core:1.17.0")
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.json:json:20250517")
}
