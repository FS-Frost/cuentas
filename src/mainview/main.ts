import "./app.css";
import { mount } from "svelte";
import App from "./App.svelte";
import "./lib/rpc"; // inicializa Electroview (RPC con el proceso bun)

const app = mount(App, {
  target: document.getElementById("app")!,
});

export default app;
