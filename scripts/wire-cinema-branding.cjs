const {
  copyFileSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} = require("node:fs");
const path = require("node:path");

const assetCatalogInfo = { author: "xcode", version: 1 };

function copy(source, target) {
  mkdirSync(path.dirname(target), { recursive: true });
  copyFileSync(source, target);
}

function edit(file, transform) {
  writeFileSync(file, transform(readFileSync(file, "utf8")));
}

function writeCatalog(directory, content) {
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    path.join(directory, "Contents.json"),
    JSON.stringify({ ...content, info: assetCatalogInfo }, null, 2) + "\n"
  );
}

function wireAndroid(probe, assets) {
  const main = path.join(probe, "android/app/src/main");
  const res = path.join(main, "res");

  for (const [density, width] of [
    ["mdpi", 80],
    ["hdpi", 120],
    ["xhdpi", 160],
    ["xxhdpi", 240],
    ["xxxhdpi", 320],
  ]) {
    const mipmap = path.join(res, "mipmap-" + density);
    const icon = path.join(assets, "android", `icon-${width}.png`);
    copy(icon, path.join(mipmap, "ic_launcher.png"));
    copy(icon, path.join(mipmap, "ic_launcher_round.png"));
    copy(
      path.join(assets, "android", `banner-${width * 2}.png`),
      path.join(mipmap, "cinema_banner.png")
    );
  }

  copy(
    path.join(assets, "cinema-mark.png"),
    path.join(res, "drawable-nodpi/cinema_mark.png")
  );
  copy(
    path.join(assets, "android/cinema_splash.xml"),
    path.join(res, "drawable/cinema_splash.xml")
  );

  edit(path.join(main, "AndroidManifest.xml"), (xml) => {
    if (xml.includes("android:banner=")) {
      return xml.replace(
        /android:banner="[^"]+"/,
        'android:banner="@mipmap/cinema_banner"'
      );
    }
    return xml.replace(
      "<application",
      '<application\n      android:banner="@mipmap/cinema_banner"'
    );
  });
  edit(path.join(res, "values/strings.xml"), (xml) =>
    xml.replace(/(<string name="app_name">)[^<]+/, "$1Itar Cinema")
  );
  edit(path.join(res, "values/styles.xml"), (xml) => {
    if (xml.includes("@drawable/cinema_splash")) return xml;
    return xml.replace(
      "</style>",
      `
        <item name="android:windowBackground">@drawable/cinema_splash</item>
        <item name="android:windowSplashScreenBackground">#0D141D</item>
        <item name="android:windowSplashScreenAnimatedIcon">@drawable/cinema_mark</item>
    </style>`
    );
  });
}

function wireApple(probe, assets) {
  const app = path.join(probe, "ios/ItarProbe");
  const catalog = path.join(app, "Images.xcassets");
  const tv = path.join(catalog, "Cinema TV.brandassets");

  function imageSet(directory, variants) {
    const images = variants.map(([source, scale, idiom = "tv"]) => {
      const filename = path.basename(source);
      copy(path.join(assets, source), path.join(directory, filename));
      return { idiom, filename, scale };
    });
    writeCatalog(directory, { images });
  }

  function imageStack(name, widths) {
    const directory = path.join(tv, name);
    const layers = ["foreground", "background"].map((layer) => {
      const filename = `${layer}.imagestacklayer`;
      imageSet(
        path.join(directory, filename, "Content.imageset"),
        widths.map((width, index) => [
          `apple/${layer}-${width}.png`,
          `${index + 1}x`,
        ])
      );
      return { filename };
    });
    writeCatalog(directory, { layers });
  }

  imageStack("App Icon.imagestack", [400, 800]);
  imageStack("App Store Icon.imagestack", [1280]);
  imageSet(path.join(tv, "Top Shelf Image.imageset"), [
    ["apple/top-shelf-1920.png", "1x"],
    ["apple/top-shelf-3840.png", "2x"],
  ]);
  imageSet(path.join(tv, "Top Shelf Image Wide.imageset"), [
    ["apple/top-shelf-2320.png", "1x"],
    ["apple/top-shelf-4640.png", "2x"],
  ]);
  writeCatalog(tv, {
    assets: [
      {
        filename: "App Icon.imagestack",
        idiom: "tv",
        role: "primary-app-icon",
        size: "400x240",
      },
      {
        filename: "App Store Icon.imagestack",
        idiom: "tv",
        role: "primary-app-icon",
        size: "1280x768",
      },
      {
        filename: "Top Shelf Image.imageset",
        idiom: "tv",
        role: "top-shelf-image",
        size: "1920x720",
      },
      {
        filename: "Top Shelf Image Wide.imageset",
        idiom: "tv",
        role: "top-shelf-image-wide",
        size: "2320x720",
      },
    ],
  });
  imageSet(path.join(catalog, "CinemaMark.imageset"), [
    ["cinema-mark.png", "1x", "universal"],
  ]);
  copy(
    path.join(assets, "apple/LaunchScreen.storyboard"),
    path.join(app, "LaunchScreen.storyboard")
  );
  edit(path.join(app, "Info.plist"), (plist) =>
    plist.replace(
      /(<key>CFBundleDisplayName<\/key>\s*<string>)[^<]+/,
      "$1Itar Cinema"
    )
  );
  edit(path.join(probe, "ios/ItarProbe.xcodeproj/project.pbxproj"), (project) =>
    project.replaceAll(
      "ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;",
      'ASSETCATALOG_COMPILER_APPICON_NAME = "Cinema TV";'
    )
  );
}

function wireCinemaBranding(root, platform) {
  const probe = root;
  const assets = path.join(probe, "ott/assets/branding");

  if (!platform || platform === "android") wireAndroid(probe, assets);
  if (!platform || platform === "ios") wireApple(probe, assets);
}

module.exports = wireCinemaBranding;
if (require.main === module) {
  const platform = process.argv[2];
  if (platform && platform !== "android" && platform !== "ios") {
    throw new Error("Use android or ios to update a single generated shell.");
  }
  wireCinemaBranding(path.resolve(__dirname, ".."), platform);
}
