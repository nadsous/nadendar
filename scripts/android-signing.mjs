// CI : signe l'APK de release avec la clé du dépôt (secrets GitHub).
// Toujours la même clé : Android accepte alors les mises à jour sans désinstaller.
// Usage : node scripts/android-signing.mjs <chemin du keystore> (mot de passe dans ANDROID_KEYSTORE_PASSWORD)
import { readFileSync, writeFileSync } from "node:fs";

const storeFile = process.argv[2];
const password = process.env.ANDROID_KEYSTORE_PASSWORD;
if (!storeFile || !password) throw new Error("keystore ou mot de passe manquant");

const root = "src-tauri/gen/android";
writeFileSync(`${root}/keystore.properties`, `password=${password}\nkeyAlias=nadendar\nstoreFile=${storeFile.replace(/\\/g, "/")}\n`);

const gradlePath = `${root}/app/build.gradle.kts`;
let gradle = readFileSync(gradlePath, "utf8");

const signing = `
    signingConfigs {
        create("release") {
            val props = Properties()
            props.load(FileInputStream(rootProject.file("keystore.properties")))
            keyAlias = props["keyAlias"] as String
            keyPassword = props["password"] as String
            storeFile = file(props["storeFile"] as String)
            storePassword = props["password"] as String
        }
    }`;

const replace = (re, by, what) => {
  if (!re.test(gradle)) {
    console.error(gradle);
    throw new Error(`build.gradle.kts : ${what} introuvable`);
  }
  gradle = gradle.replace(re, by);
};

if (!gradle.includes("import java.io.FileInputStream")) gradle = `import java.io.FileInputStream\n${gradle}`;
if (!gradle.includes("import java.util.Properties")) gradle = `import java.util.Properties\n${gradle}`;
replace(/^android \{$/m, `android {${signing}`, "bloc android");
replace(/getByName\("release"\) \{/, `getByName("release") {\n            signingConfig = signingConfigs.getByName("release")`, "type release");

writeFileSync(gradlePath, gradle);
console.log("Signature release configurée.");
