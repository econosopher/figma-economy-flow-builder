import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@xyflow/react/dist/style.css";
import "./styles.css";
import App from "./App";
import { McpAccount } from "./components/McpAccount";
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {location.pathname === "/oauth/consent" ||
    location.pathname === "/connections" ? (
      <McpAccount />
    ) : (
      <App />
    )}
  </StrictMode>,
);
