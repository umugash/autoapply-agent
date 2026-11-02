/**
 * AutoApply-AI Visual Highlighter & Human-in-the-Loop Overlay
 * Injected into target career portals to visually guide the user during OTP, Login, Captcha, or unfillable fields.
 */

(function () {
    if (window.__AUTOAPPLY_INJECTED__) return;
    window.__AUTOAPPLY_INJECTED__ = true;
    window.__AUTOAPPLY_SIGNAL__ = null;

    // 1. Inject Styles
    const styleId = "autoapply-highlighter-styles";
    if (!document.getElementById(styleId)) {
        const style = document.createElement("style");
        style.id = styleId;
        style.textContent = `
            @keyframes autoapply-pulse {
                0% {
                    box-shadow: 0 0 0 0 rgba(255, 45, 85, 0.7), 0 0 15px rgba(255, 45, 85, 0.9);
                    border-color: #ff2d55 !important;
                }
                50% {
                    box-shadow: 0 0 0 14px rgba(255, 45, 85, 0), 0 0 30px rgba(255, 45, 85, 1);
                    border-color: #ff0033 !important;
                }
                100% {
                    box-shadow: 0 0 0 0 rgba(255, 45, 85, 0), 0 0 15px rgba(255, 45, 85, 0.9);
                    border-color: #ff2d55 !important;
                }
            }

            .autoapply-highlight-critical {
                outline: 4px solid #ff2d55 !important;
                animation: autoapply-pulse 1.8s infinite ease-in-out !important;
                position: relative !important;
                z-index: 999999 !important;
                background-color: rgba(255, 45, 85, 0.08) !important;
                border-radius: 6px !important;
            }

            .autoapply-highlight-fill {
                outline: 2px solid #00f0ff !important;
                box-shadow: 0 0 12px rgba(0, 240, 255, 0.6) !important;
                transition: all 0.3s ease !important;
            }

            #autoapply-hud {
                position: fixed !important;
                top: 16px !important;
                left: 50% !important;
                transform: translateX(-50%) !important;
                z-index: 2147483647 !important;
                background: rgba(15, 23, 42, 0.95) !important;
                backdrop-filter: blur(12px) !important;
                -webkit-backdrop-filter: blur(12px) !important;
                border: 1px solid rgba(255, 45, 85, 0.6) !important;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6), 0 0 20px rgba(255, 45, 85, 0.3) !important;
                color: #ffffff !important;
                padding: 12px 24px !important;
                border-radius: 9999px !important;
                display: flex !important;
                align-items: center !important;
                gap: 16px !important;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
                font-size: 14px !important;
                font-weight: 500 !important;
                box-sizing: border-box !important;
            }

            #autoapply-hud .badge {
                background: #ff2d55 !important;
                color: #ffffff !important;
                padding: 4px 10px !important;
                border-radius: 999px !important;
                font-size: 11px !important;
                font-weight: 700 !important;
                letter-spacing: 0.5px !important;
                text-transform: uppercase !important;
                display: flex !important;
                align-items: center !important;
                gap: 6px !important;
            }

            #autoapply-hud .badge-dot {
                width: 8px !important;
                height: 8px !important;
                background: #ffffff !important;
                border-radius: 50% !important;
                display: inline-block !important;
                animation: autoapply-pulse 1s infinite !important;
            }

            #autoapply-hud .msg {
                color: #e2e8f0 !important;
                max-width: 480px !important;
                white-space: nowrap !important;
                overflow: hidden !important;
                text-overflow: ellipsis !important;
            }

            #autoapply-hud .btn-resume {
                background: linear-gradient(135deg, #10b981, #059669) !important;
                color: white !important;
                border: none !important;
                padding: 8px 18px !important;
                border-radius: 999px !important;
                font-size: 13px !important;
                font-weight: 600 !important;
                cursor: pointer !important;
                box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4) !important;
                transition: transform 0.15s ease, box-shadow 0.15s ease !important;
            }

            #autoapply-hud .btn-resume:hover {
                transform: scale(1.05) !important;
                box-shadow: 0 6px 16px rgba(16, 185, 129, 0.6) !important;
            }

            #autoapply-hud .btn-skip {
                background: rgba(255, 255, 255, 0.1) !important;
                color: #cbd5e1 !important;
                border: 1px solid rgba(255, 255, 255, 0.2) !important;
                padding: 8px 14px !important;
                border-radius: 999px !important;
                font-size: 12px !important;
                cursor: pointer !important;
            }

            #autoapply-hud .btn-skip:hover {
                background: rgba(255, 255, 255, 0.2) !important;
                color: #ffffff !important;
            }
        `;
        document.head.appendChild(style);
    }

    // 2. HUD Controller
    window.__AutoApplyHUD = {
        show: function (message, type = "intervention") {
            let hud = document.getElementById("autoapply-hud");
            if (!hud) {
                hud = document.createElement("div");
                hud.id = "autoapply-hud";
                document.body.appendChild(hud);
            }

            const badgeText = type === "intervention" ? "ACTION NEEDED" : "AUTOAPPLY AGENT";
            const badgeColor = type === "intervention" ? "#ff2d55" : "#00f0ff";

            hud.innerHTML = `
                <div class="badge" style="background: ${badgeColor};">
                    <span class="badge-dot"></span>
                    <span>${badgeText}</span>
                </div>
                <div class="msg">${message}</div>
                <button id="autoapply-btn-resume" class="btn-resume">Done &amp; Resume &rarr;</button>
                <button id="autoapply-btn-skip" class="btn-skip">Skip</button>
            `;

            document.getElementById("autoapply-btn-resume").addEventListener("click", () => {
                window.__AUTOAPPLY_SIGNAL__ = "resume";
                window.__AutoApplyHUD.hide();
            });

            document.getElementById("autoapply-btn-skip").addEventListener("click", () => {
                window.__AUTOAPPLY_SIGNAL__ = "skip";
                window.__AutoApplyHUD.hide();
            });
        },

        hide: function () {
            const hud = document.getElementById("autoapply-hud");
            if (hud) hud.remove();
        },

        highlightElement: function (selectorOrEl, critical = true) {
            let el = typeof selectorOrEl === "string" ? document.querySelector(selectorOrEl) : selectorOrEl;
            if (!el) return;
            el.scrollIntoView({ behavior: "smooth", block: "center" });
            const cls = critical ? "autoapply-highlight-critical" : "autoapply-highlight-fill";
            el.classList.add(cls);
        },

        removeHighlights: function () {
            document.querySelectorAll(".autoapply-highlight-critical, .autoapply-highlight-fill").forEach(el => {
                el.classList.remove("autoapply-highlight-critical", "autoapply-highlight-fill");
            });
        },

        detectInterventions: function () {
            // Find CAPTCHA frames & containers
            const captchas = document.querySelectorAll(`
                iframe[src*="recaptcha"],
                iframe[src*="turnstile"],
                iframe[src*="hcaptcha"],
                iframe[src*="arkose"],
                .g-recaptcha,
                .cf-turnstile,
                .h-captcha
            `);

            // Find OTP or verification code inputs
            const otps = document.querySelectorAll(`
                input[autocomplete*="one-time-code"],
                input[name*="otp" i],
                input[id*="otp" i],
                input[placeholder*="verification code" i],
                input[placeholder*="enter code" i],
                input[name*="code" i][maxlength="6"]
            `);

            // Find login password fields if stopped at a login wall
            const passwords = document.querySelectorAll(`input[type="password"]`);

            if (captchas.length > 0) {
                this.highlightElement(captchas[0], true);
                this.show("⚠️ CAPTCHA detected! Please complete the verification, then click 'Done & Resume'.", "intervention");
                return "captcha";
            } else if (otps.length > 0) {
                this.highlightElement(otps[0], true);
                this.show("📱 OTP / 2FA code requested! Please enter the code received on your phone/email, then click 'Done & Resume'.", "intervention");
                return "otp";
            } else if (passwords.length > 0 && !window.__autoapply_login_passed__) {
                this.highlightElement(passwords[0], true);
                this.show("🔐 Portal Login required! Please log in to your account, then click 'Done & Resume'.", "intervention");
                return "login";
            }

            return null;
        }
    };
})();
