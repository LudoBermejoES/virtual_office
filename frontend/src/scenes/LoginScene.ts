import * as Phaser from "phaser";
import { BASE_URL } from "../config.js";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string;

export class LoginScene extends Phaser.Scene {
  private errorText?: Phaser.GameObjects.Text;
  private overlay?: HTMLDivElement;

  constructor() {
    super({ key: "LoginScene" });
  }

  create(): void {
    const { width, height } = this.scale;

    this.add
      .text(width / 2, height / 2 - 60, "VIRTUAL OFFICE", {
        fontFamily: '"Press Start 2P"',
        fontSize: "20px",
        color: "#00ff9f",
        align: "center",
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height / 2, "PRESS START\nLOGIN WITH GOOGLE", {
        fontFamily: '"Press Start 2P"',
        fontSize: "12px",
        color: "#ffffff",
        align: "center",
        lineSpacing: 10,
      })
      .setOrigin(0.5);

    this.errorText = this.add
      .text(width / 2, height / 2 + 80, "", {
        fontFamily: '"VT323"',
        fontSize: "20px",
        color: "#ff4444",
        align: "center",
      })
      .setOrigin(0.5);

    this.mountGoogleButton();
  }

  private mountGoogleButton(): void {
    this.overlay = document.createElement("div");
    this.overlay.id = "gis-overlay";
    Object.assign(this.overlay.style, {
      position: "fixed",
      bottom: "80px",
      left: "50%",
      transform: "translateX(-50%)",
      zIndex: "10",
    });

    const buttonDiv = document.createElement("div");
    buttonDiv.id = "google-signin-button";
    this.overlay.appendChild(buttonDiv);
    document.body.appendChild(this.overlay);

    this.loadGIS().then(() => {
      (
        window as unknown as {
          google: {
            accounts: {
              id: {
                initialize: (c: object) => void;
                renderButton: (el: HTMLElement, o: object) => void;
              };
            };
          };
        }
      ).google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response: { credential: string }) => {
          this.handleCredential(response.credential);
        },
      });

      (
        window as unknown as {
          google: { accounts: { id: { renderButton: (el: HTMLElement, o: object) => void } } };
        }
      ).google.accounts.id.renderButton(buttonDiv, {
        theme: "filled_black",
        size: "large",
        text: "signin_with",
      });
    });
  }

  private loadGIS(): Promise<void> {
    return new Promise((resolve) => {
      if (document.getElementById("gis-script")) {
        resolve();
        return;
      }
      const script = document.createElement("script");
      script.id = "gis-script";
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.onload = () => resolve();
      document.head.appendChild(script);
    });
  }

  private handleCredential(idToken: string): void {
    fetch(`${BASE_URL}/api/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
      credentials: "include",
    })
      .then(async (res) => {
        if (!res.ok) {
          const data = (await res.json()) as { reason?: string };
          this.showError(data.reason ?? "error");
          return;
        }
        this.unmountOverlay();
        this.scene.start("OfficeScene");
      })
      .catch(() => {
        this.showError("error de red");
      });
  }

  private showError(reason: string): void {
    const messages: Record<string, string> = {
      domain_not_allowed: "DOMINIO NO PERMITIDO",
      email_not_verified: "EMAIL SIN VERIFICAR",
      invalid_token: "TOKEN INVALIDO",
    };
    const text = messages[reason] ?? "ERROR DE AUTENTICACION";
    this.errorText?.setText(text);
  }

  private unmountOverlay(): void {
    this.overlay?.remove();
    document.getElementById("gis-script")?.remove();
  }

  shutdown(): void {
    this.unmountOverlay();
  }
}
