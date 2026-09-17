import { mountSickmapsPreview } from "./preview";

const app = document.getElementById("app");
if (!app) {
  throw new Error("Missing #app");
}

void mountSickmapsPreview({
  root: app,
  theme: "minecraft",
  center: [-74.02, 40.72],
  zoom: 11.2,
}).catch((err) => {
  console.error(err);
});
