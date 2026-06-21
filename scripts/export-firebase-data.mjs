import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, signOut } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
} from "firebase/firestore";
import {
  getDownloadURL,
  getMetadata,
  getStorage,
  listAll,
  ref,
} from "firebase/storage";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing ${name} environment variable. See .env.example.`);
    process.exit(1);
  }
  return value;
}

const firebaseConfig = {
  apiKey: requireEnv("FIREBASE_API_KEY"),
  authDomain: requireEnv("FIREBASE_AUTH_DOMAIN"),
  databaseURL: requireEnv("FIREBASE_DATABASE_URL"),
  projectId: requireEnv("FIREBASE_PROJECT_ID"),
  storageBucket: requireEnv("FIREBASE_STORAGE_BUCKET"),
  appId: requireEnv("FIREBASE_APP_ID"),
};

const compatibilityEmail = requireEnv("FIREBASE_EXPORT_EMAIL");
const compatibilityPassword = requireEnv("FIREBASE_EXPORT_PASSWORD");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const exportRoot = path.join(
  repoRoot,
  "exports",
  `firebase-${new Date().toISOString().replace(/[:.]/g, "-")}`,
);

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const firestore = getFirestore(app);
const storage = getStorage(app);

function sanitizePathSegment(value) {
  return String(value || "unknown")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .trim();
}

function serializeFirestoreValue(value) {
  if (value === undefined) return null;
  if (value === null) return null;
  if (Array.isArray(value)) return value.map(serializeFirestoreValue);

  if (typeof value === "object") {
    if (typeof value.toDate === "function" && "seconds" in value) {
      return {
        __type: "timestamp",
        iso: value.toDate().toISOString(),
        seconds: value.seconds,
        nanoseconds: value.nanoseconds,
      };
    }

    if (typeof value.path === "string" && value.firestore) {
      return {
        __type: "documentReference",
        path: value.path,
      };
    }

    if ("latitude" in value && "longitude" in value) {
      return {
        __type: "geoPoint",
        latitude: value.latitude,
        longitude: value.longitude,
      };
    }

    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        serializeFirestoreValue(nestedValue),
      ]),
    );
  }

  return value;
}

function getExtensionFromContentType(contentType) {
  if (!contentType) return "";
  if (contentType.includes("jpeg")) return ".jpg";
  if (contentType.includes("png")) return ".png";
  if (contentType.includes("gif")) return ".gif";
  if (contentType.includes("webp")) return ".webp";
  if (contentType.includes("svg")) return ".svg";
  return "";
}

function getExtensionFromUrl(url) {
  try {
    const pathname = new URL(url).pathname;
    const extension = path.extname(pathname);
    return extension.length <= 6 ? extension : "";
  } catch {
    return "";
  }
}

async function writeJson(filePath, data) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

async function downloadUrl(url, targetWithoutExtension) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  const extension =
    path.extname(targetWithoutExtension) ||
    getExtensionFromUrl(url) ||
    getExtensionFromContentType(contentType) ||
    ".bin";
  const targetPath = path.extname(targetWithoutExtension)
    ? targetWithoutExtension
    : `${targetWithoutExtension}${extension}`;
  const arrayBuffer = await response.arrayBuffer();

  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, Buffer.from(arrayBuffer));

  return {
    savedPath: path.relative(exportRoot, targetPath).replaceAll("\\", "/"),
    contentType,
    bytes: arrayBuffer.byteLength,
  };
}

async function exportStorageFolder(folderPath, manifest) {
  const listResult = await listAll(ref(storage, folderPath));

  for (const itemRef of listResult.items) {
    const [url, metadata] = await Promise.all([
      getDownloadURL(itemRef),
      getMetadata(itemRef).catch(() => null),
    ]);
    const safeRelativePath = itemRef.fullPath
      .split("/")
      .map(sanitizePathSegment)
      .join(path.sep);
    const targetBase = path.join(exportRoot, "storage", safeRelativePath);

    try {
      const downloaded = await downloadUrl(url, targetBase);
      manifest.storageFiles.push({
        fullPath: itemRef.fullPath,
        downloadUrl: url,
        metadata,
        ...downloaded,
      });
      console.log(`Downloaded storage file: ${itemRef.fullPath}`);
    } catch (error) {
      manifest.errors.push({
        scope: "storage",
        path: itemRef.fullPath,
        message: error instanceof Error ? error.message : String(error),
      });
      console.warn(`Unable to download storage file ${itemRef.fullPath}:`, error);
    }
  }

  for (const prefixRef of listResult.prefixes) {
    await exportStorageFolder(prefixRef.fullPath, manifest);
  }
}

async function exportFirebaseData() {
  await mkdir(exportRoot, { recursive: true });
  console.log(`Exporting Firebase data to: ${exportRoot}`);

  await signInWithEmailAndPassword(
    auth,
    compatibilityEmail,
    compatibilityPassword,
  );

  const manifest = {
    exportedAt: new Date().toISOString(),
    firebaseProjectId: firebaseConfig.projectId,
    rootDocumentPath: "Stock/Stocks",
    categories: [],
    referencedImages: [],
    storageFiles: [],
    errors: [],
  };

  const rootSnapshot = await getDoc(doc(firestore, "Stock", "Stocks"));
  const rootData = rootSnapshot.exists()
    ? serializeFirestoreValue(rootSnapshot.data())
    : null;
  const categories = Array.isArray(rootData?.type) ? rootData.type : [];

  await writeJson(path.join(exportRoot, "firestore", "Stock__Stocks.json"), {
    id: "Stocks",
    path: "Stock/Stocks",
    exists: rootSnapshot.exists(),
    data: rootData,
  });

  for (const category of categories) {
    const safeCategory = sanitizePathSegment(category);
    const categoryDir = path.join(exportRoot, "firestore", "categories", safeCategory);
    const snapshot = await getDocs(collection(firestore, "Stock", "Stocks", category));
    const documents = snapshot.docs.map((itemDoc) => ({
      id: itemDoc.id,
      path: itemDoc.ref.path,
      data: serializeFirestoreValue(itemDoc.data()),
    }));

    manifest.categories.push({
      name: category,
      documentCount: documents.length,
      savedPath: path
        .relative(exportRoot, path.join(categoryDir, "documents.json"))
        .replaceAll("\\", "/"),
    });

    await writeJson(path.join(categoryDir, "documents.json"), documents);

    for (const item of documents) {
      const imageUrl = item.data?.img;
      if (typeof imageUrl !== "string" || !imageUrl.trim()) continue;

      const safeId = sanitizePathSegment(item.id);
      const targetBase = path.join(
        exportRoot,
        "images",
        "by-reference",
        safeCategory,
        safeId,
      );

      try {
        const downloaded = await downloadUrl(imageUrl, targetBase);
        manifest.referencedImages.push({
          category,
          itemId: item.id,
          sourceField: "img",
          url: imageUrl,
          ...downloaded,
        });
        console.log(`Downloaded referenced image: ${category}/${item.id}`);
      } catch (error) {
        manifest.errors.push({
          scope: "referencedImage",
          category,
          itemId: item.id,
          url: imageUrl,
          message: error instanceof Error ? error.message : String(error),
        });
        console.warn(`Unable to download image ${category}/${item.id}:`, error);
      }
    }

    try {
      await exportStorageFolder(category, manifest);
    } catch (error) {
      manifest.errors.push({
        scope: "storageFolder",
        path: category,
        message: error instanceof Error ? error.message : String(error),
      });
      console.warn(`Unable to list storage folder ${category}:`, error);
    }
  }

  await writeJson(path.join(exportRoot, "manifest.json"), manifest);
  await signOut(auth).catch(() => undefined);

  console.log("Firebase export complete.");
  console.log(`Categories: ${manifest.categories.length}`);
  console.log(
    `Firestore docs: ${manifest.categories.reduce(
      (total, category) => total + category.documentCount,
      0,
    )}`,
  );
  console.log(`Referenced images: ${manifest.referencedImages.length}`);
  console.log(`Storage files: ${manifest.storageFiles.length}`);
  console.log(`Errors: ${manifest.errors.length}`);
}

exportFirebaseData()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("Firebase export failed:", error);
    process.exit(1);
  });
