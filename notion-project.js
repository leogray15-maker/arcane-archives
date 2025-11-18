import { protectPage } from "./auth-guard.js";

protectPage({
  onFailure: () => {
    window.location.href = "login.html";
  }
});
