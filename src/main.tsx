import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { StackProvider, StackTheme } from "@stackframe/react";
import { stackApp } from "./lib/stack";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <StackProvider app={stackApp}>
        <StackTheme>
          <App />
        </StackTheme>
      </StackProvider>
    </BrowserRouter>
  </StrictMode>
);
