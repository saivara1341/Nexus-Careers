const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const files = [
  'android/app/capacitor.build.gradle',
  'android/capacitor-cordova-android-plugins/build.gradle',
  'node_modules/@capacitor/android/capacitor/build.gradle',
];

for (const relativePath of files) {
  const filePath = path.join(root, relativePath);
  if (!fs.existsSync(filePath)) continue;

  const original = fs.readFileSync(filePath, 'utf8');
  const patched = original.replaceAll('JavaVersion.VERSION_21', 'JavaVersion.VERSION_17');
  if (patched !== original) {
    fs.writeFileSync(filePath, patched);
    console.log(`Patched ${relativePath} for the local JDK 17 Android build.`);
  }
}
