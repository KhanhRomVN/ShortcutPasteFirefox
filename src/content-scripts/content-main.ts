// Firefox Content Script - Compatible with both Firefox and Chrome

// Type declarations for Firefox browser API (must be at global scope)
declare const browser: typeof chrome;

(function () {
  "use strict";

  // Firefox/Chrome API compatibility layer
  const browserAPI = (function () {
    if (typeof (globalThis as any).browser !== "undefined") {
      return (globalThis as any).browser; // Firefox
    } else if (typeof (globalThis as any).chrome !== "undefined") {
      return (globalThis as any).chrome; // Chrome
    }
    throw new Error("No browser API available");
  })();

  // Inline Logger
  class ContentLogger {
    log(
      level: "info" | "warn" | "error" | "debug",
      message: string,
      context?: any
    ): void {
      const consoleMethod = (console as any)[level] || console.log;
      consoleMethod(`[content-script]`, message, context || "");
    }

    info(message: string, context?: any): void {
      this.log("info", message, context);
    }
    warn(message: string, context?: any): void {
      this.log("warn", message, context);
    }
    error(message: string, context?: any): void {
      this.log("error", message, context);
    }
    debug(message: string, context?: any): void {
      this.log("debug", message, context);
    }
  }

  const logger = new ContentLogger();

  // Inline PasteHandler
  class PasteHandler {
    async pasteContent(
      content: string,
      contentType?: string
    ): Promise<boolean> {
      logger.info("🎯 PasteHandler.pasteContent called", {
        contentLength: content?.length || 0,
        contentType: contentType || "unknown",
        hasContent: !!content,
      });

      if (!content || typeof content !== "string") {
        logger.error("❌ Invalid content provided to pasteContent", {
          content,
        });
        return false;
      }

      const activeElement = document.activeElement as HTMLElement | null;
      logger.info("📍 Active element info:", {
        hasActiveElement: !!activeElement,
        tagName: activeElement?.tagName,
        type: (activeElement as HTMLInputElement)?.type,
        isContentEditable: activeElement?.isContentEditable,
        id: activeElement?.id || "no-id",
        className: activeElement?.className || "no-class",
      });

      if (!activeElement) {
        logger.warn(
          "❌ No active element found, searching for focusable elements...",
          {}
        );

        const focusableSelectors = [
          "input:not([disabled]):not([readonly])",
          "textarea:not([disabled]):not([readonly])",
          '[contenteditable="true"]',
          '[contenteditable=""]',
        ];

        const focusableElements = document.querySelectorAll(
          focusableSelectors.join(", ")
        );
        logger.info(
          `🔍 Found ${focusableElements.length} potentially focusable elements`,
          {}
        );

        if (focusableElements.length > 0) {
          const firstFocusable = focusableElements[0] as HTMLElement;
          logger.info("🎯 Attempting to focus first focusable element:", {
            tagName: firstFocusable.tagName,
            type: (firstFocusable as HTMLInputElement).type,
          });

          try {
            firstFocusable.focus();
            await new Promise((resolve) => setTimeout(resolve, 100));
            return this.pasteContent(content, contentType);
          } catch (focusError) {
            logger.error("❌ Failed to focus element:", focusError);
            return false;
          }
        }

        logger.error("❌ No focusable elements found on page", {});
        return false;
      }

      try {
        if (contentType === "image" && content.startsWith("data:image/")) {
          logger.info("🖼️ Handling image content", {});
          return this.insertContent(activeElement, content, "image");
        } else if (contentType === "html" && this.isHtmlContent(content)) {
          logger.info("🌐 Handling HTML content", {});
          return this.insertContent(activeElement, content, "html");
        } else if (contentType === "url" && this.isUrlContent(content)) {
          logger.info("🔗 Handling URL content", {});
          return this.insertContent(activeElement, content, "url");
        } else {
          logger.info("📝 Handling text content", {});
          return this.insertContent(activeElement, content, "text");
        }
      } catch (error) {
        logger.error("💥 Error pasting content:", error);
        return false;
      }
    }

    private async insertContent(
      element: HTMLElement,
      content: string,
      type: string
    ): Promise<boolean> {
      try {
        logger.info(`📝 Inserting ${type} content into ${element.tagName}`, {});

        if (
          element instanceof HTMLInputElement ||
          element instanceof HTMLTextAreaElement
        ) {
          return this.pasteToInput(element, content, type);
        } else if (element.isContentEditable) {
          return await this.pasteToContentEditable(element, content, type);
        } else {
          logger.warn("❌ Active element is not editable:", {
            tagName: element.tagName,
            contentEditable: element.getAttribute("contenteditable"),
            disabled: (element as HTMLInputElement).disabled,
            readOnly: (element as HTMLInputElement).readOnly,
          });
          return false;
        }
      } catch (error) {
        logger.error("💥 Error inserting content:", error);
        return false;
      }
    }

    private triggerInputEvents(element: HTMLElement): void {
      try {
        // Comprehensive event triggering for modern editors
        const events = [
          new Event("focus", { bubbles: true, composed: true }),
          new Event("focusin", { bubbles: true, composed: true }),
          new InputEvent("beforeinput", {
            bubbles: true,
            composed: true,
            inputType: "insertText",
          }),
          new InputEvent("input", {
            bubbles: true,
            composed: true,
            inputType: "insertText",
          }),
          new InputEvent("textInput", {
            // For older browsers
            bubbles: true,
            composed: true,
          } as any),
          new Event("change", { bubbles: true, composed: true }),
          new KeyboardEvent("keydown", {
            bubbles: true,
            composed: true,
            key: "v",
            ctrlKey: true,
          }),
          new KeyboardEvent("keypress", {
            bubbles: true,
            composed: true,
            key: "v",
          }),
          new KeyboardEvent("keyup", {
            bubbles: true,
            composed: true,
            key: "v",
            ctrlKey: true,
          }),
          // Mutation events for legacy support
          new Event("DOMSubtreeModified", { bubbles: true }),
        ];

        events.forEach((event) => {
          try {
            element.dispatchEvent(event);
          } catch (e) {
            logger.debug("Event dispatch warning:", e);
          }
        });

        // Special handling for React/Vue/ProseMirror
        const reactKeys = Object.keys(element).find(
          (key) =>
            key.startsWith("__reactInternalInstance") ||
            key.startsWith("_reactInternalFiber") ||
            key.startsWith("__reactProps")
        );

        if (reactKeys) {
          logger.debug(
            "🔄 Detected React component, triggering blur/focus cycle"
          );
          element.dispatchEvent(
            new Event("blur", { bubbles: true, composed: true })
          );
          setTimeout(() => {
            element.dispatchEvent(
              new Event("focus", { bubbles: true, composed: true })
            );
          }, 10);
        }

        // Check for ProseMirror (used by Claude.ai, Notion, etc.)
        const isProseMirror =
          element.classList.contains("ProseMirror") ||
          element.querySelector(".ProseMirror") ||
          element.hasAttribute("contenteditable");

        if (isProseMirror) {
          logger.debug(
            "🔄 Detected ProseMirror editor, triggering additional events"
          );
          // ProseMirror listens to these specific events
          element.dispatchEvent(
            new Event("compositionend", { bubbles: true, composed: true })
          );
        }
      } catch (error) {
        logger.warn("⚠️ Some input events failed to trigger:", error);
      }
    }

    private pasteToInput(
      element: HTMLInputElement | HTMLTextAreaElement,
      content: string,
      type: string
    ): boolean {
      logger.info("📝 Pasting to input element:", {
        tagName: element.tagName,
        type: (element as HTMLInputElement).type,
        disabled: element.disabled,
        readOnly: element.readOnly,
        selectionStart: element.selectionStart,
        selectionEnd: element.selectionEnd,
        contentType: type,
      });

      if (element.disabled || element.readOnly) {
        logger.warn("⚠️ Element is disabled or readonly", {});
        return false;
      }

      try {
        const start = element.selectionStart || 0;
        const end = element.selectionEnd || 0;

        logger.info(`📍 Inserting content at position ${start}-${end}`, {});

        let insertContent = content;

        // Handle special cases for image data URLs
        if (
          type === "image" &&
          content.startsWith("data:image/") &&
          element.tagName === "INPUT"
        ) {
          if (content.length > 2000) {
            insertContent = "[Image data - too large for text field]";
            logger.info("🖼️ Image data URL truncated for input field", {});
          }
        }

        // CRITICAL: Preserve line breaks for textarea, convert for single-line input
        const hasLineBreaks = /\r?\n/.test(insertContent);

        if (element.tagName === "INPUT" && hasLineBreaks) {
          // Only convert line breaks to spaces for actual <input> elements
          insertContent = insertContent.replace(/\r?\n/g, " ");
          logger.info(`⚠️ Converted line breaks to spaces for <input> element`);
        } else if (element.tagName === "TEXTAREA" && hasLineBreaks) {
          // Preserve line breaks for textarea
          logger.info(
            `✅ Preserving ${
              insertContent.split(/\r?\n/).length
            } lines for <textarea>`
          );
        }

        // Insert content at cursor position
        const newValue =
          element.value.substring(0, start) +
          insertContent +
          element.value.substring(end);
        element.value = newValue;

        // Set cursor position after inserted content
        const newCursorPos = start + insertContent.length;
        element.selectionStart = element.selectionEnd = newCursorPos;

        logger.info(
          `🎯 New cursor position: ${newCursorPos}, value length: ${newValue.length}`,
          {}
        );

        // Trigger input events for frameworks like React/Vue to detect changes
        this.triggerInputEvents(element);

        // Ensure the element is focused
        element.focus();

        logger.info("✅ Input paste completed successfully", {});
        return true;
      } catch (error) {
        logger.error("❌ Failed to paste to input:", error);
        return false;
      }
    }

    async pasteToContentEditable(
      element: HTMLElement,
      content: string,
      type: string
    ): Promise<boolean> {
      logger.info("📝 Pasting to contentEditable element", {
        contentType: type,
        contentLength: content.length,
        hasLineBreaks: /\r?\n/.test(content),
        lineCount: content.split(/\r?\n/).length,
      });

      try {
        // Ensure element is focused first
        element.focus();

        // PRIORITY: Try execCommand insertText first - best for preserving line breaks
        if (document.queryCommandSupported?.("insertText")) {
          logger.info(
            "🎯 Trying execCommand insertText (best for line breaks)"
          );

          const success = document.execCommand("insertText", false, content);

          if (success) {
            logger.info("✅ execCommand insertText succeeded!");
            this.triggerInputEvents(element);
            return true;
          } else {
            logger.warn(
              "⚠️ execCommand insertText returned false, trying fallback"
            );
          }
        }

        // Strategy 2: Try modern Input Events API
        if (typeof InputEvent !== "undefined") {
          logger.info("🎯 Trying Input Events API with insertText");

          // Trigger beforeinput event
          const beforeInputEvent = new InputEvent("beforeinput", {
            bubbles: true,
            cancelable: true,
            inputType: "insertText",
            data: content,
            composed: true,
          });

          const notCancelled = element.dispatchEvent(beforeInputEvent);

          if (notCancelled) {
            // Use execCommand for actual insertion
            const success = document.execCommand("insertText", false, content);

            if (success) {
              // Trigger input event after insertion
              const inputEvent = new InputEvent("input", {
                bubbles: true,
                inputType: "insertText",
                data: content,
                composed: true,
              });
              element.dispatchEvent(inputEvent);

              this.triggerInputEvents(element);
              logger.info("✅ Paste successful via Input Events API");
              return true;
            }
          }
        }

        // Strategy 2: Clipboard API approach (for modern editors)
        if (navigator.clipboard?.writeText) {
          logger.info("🎯 Trying Clipboard API");

          try {
            await navigator.clipboard.writeText(content);
            await new Promise((resolve) => setTimeout(resolve, 50));

            // Simulate paste event
            const pasteEvent = new ClipboardEvent("paste", {
              bubbles: true,
              cancelable: true,
              composed: true,
            });

            // Try to set clipboardData
            Object.defineProperty(pasteEvent, "clipboardData", {
              value: {
                getData: (format: string) =>
                  format === "text/plain" ? content : "",
                types: ["text/plain"],
              },
            });

            element.dispatchEvent(pasteEvent);
            this.triggerInputEvents(element);

            // Verify paste worked
            await new Promise((resolve) => setTimeout(resolve, 100));
            const currentText = element.textContent || element.innerText || "";

            if (
              currentText.includes(
                content.substring(0, Math.min(50, content.length))
              )
            ) {
              logger.info("✅ Paste successful via Clipboard API");
              return true;
            }
          } catch (error) {
            logger.warn("Clipboard API failed:", error);
          }
        }

        // Strategy 3: Direct DOM manipulation fallback
        logger.info("🎯 Using DOM manipulation fallback");
        return this.fallbackPasteToContentEditable(element, content, type);
      } catch (error) {
        logger.error("❌ Failed to paste to contentEditable:", error);
        return false;
      }
    }

    private fallbackPasteToContentEditable(
      element: HTMLElement,
      content: string,
      type: string
    ): boolean {
      logger.info("📝 Using fallback DOM paste method");

      try {
        const selection = window.getSelection();

        if (!selection || selection.rangeCount === 0) {
          const range = document.createRange();
          range.selectNodeContents(element);
          range.collapse(false);
          selection?.removeAllRanges();
          selection?.addRange(range);
        }

        const range = selection!.getRangeAt(0);
        range.deleteContents();

        let nodeToInsert: Node;

        if (type === "html") {
          const tempDiv = document.createElement("div");
          tempDiv.innerHTML = content;
          const fragment = document.createDocumentFragment();
          while (tempDiv.firstChild) {
            fragment.appendChild(tempDiv.firstChild);
          }
          nodeToInsert = fragment;
        } else if (type === "url") {
          const link = document.createElement("a");
          link.href = content;
          link.textContent = content;
          link.target = "_blank";
          nodeToInsert = link;
        } else if (type === "image" && content.startsWith("data:image/")) {
          const img = document.createElement("img");
          img.src = content;
          img.style.maxWidth = "100%";
          img.style.height = "auto";
          nodeToInsert = img;
        } else {
          // ENHANCED: Multi-strategy linebreak handling for modern editors
          const fragment = document.createDocumentFragment();
          const lines = content.split(/\r?\n/);

          // Detect ProseMirror or similar advanced editors (Claude.ai, Notion, etc.)
          const isProseMirror =
            element.classList.contains("ProseMirror") ||
            !!element.querySelector(".ProseMirror") ||
            element.hasAttribute("data-pm-slice") ||
            !!element.closest("[data-pm-slice]") ||
            element.getAttribute("role") === "textbox" || // Claude.ai specific
            element.getAttribute("contenteditable") === "true";

          logger.info(
            `🎯 Editor detection: ${
              isProseMirror ? "ProseMirror-like" : "Standard contentEditable"
            }`,
            {
              classList: element.className,
              role: element.getAttribute("role"),
              hasDataPmSlice: element.hasAttribute("data-pm-slice"),
              lineCount: lines.length,
            }
          );

          if (isProseMirror) {
            // Strategy for ProseMirror: Insert each line with hard line breaks
            logger.info(
              `🎯 Using ProseMirror strategy for ${lines.length} lines`
            );

            lines.forEach((line, index) => {
              // Add text node for the line content
              if (line.length > 0) {
                fragment.appendChild(document.createTextNode(line));
              } else if (index === 0 || index === lines.length - 1) {
                // For empty first/last lines, add zero-width space
                fragment.appendChild(document.createTextNode("\u200B"));
              }

              // Add hard line break (Shift+Enter) between lines
              if (index < lines.length - 1) {
                const br = document.createElement("br");
                // ProseMirror requires BR to be marked as hard break
                br.setAttribute("data-pm-slice", "0 0 []");
                fragment.appendChild(br);
              }
            });
          } else {
            // Strategy for standard contentEditable: use BR tags
            logger.info(
              `🎯 Using standard BR strategy for ${lines.length} lines`
            );

            lines.forEach((line, index) => {
              if (line.length > 0 || index === 0) {
                fragment.appendChild(document.createTextNode(line));
              }

              if (index < lines.length - 1) {
                const br = document.createElement("br");
                fragment.appendChild(br);

                // Double BR for empty lines (better compatibility)
                if (line.length === 0) {
                  fragment.appendChild(document.createElement("br"));
                }
              }
            });
          }

          nodeToInsert = fragment;
        }

        range.insertNode(nodeToInsert);
        range.setStartAfter(nodeToInsert);
        range.setEndAfter(nodeToInsert);
        selection!.removeAllRanges();
        selection!.addRange(range);

        this.triggerInputEvents(element);
        element.focus();

        setTimeout(() => {
          element.focus();
        }, 50);

        logger.info("✅ Fallback paste completed successfully");
        return true;
      } catch (error) {
        logger.error("❌ Fallback paste failed:", error);
        return false;
      }
    }

    private isHtmlContent(content: string): boolean {
      const trimmed = content.trim();
      return (
        trimmed.includes("<") &&
        trimmed.includes(">") &&
        (trimmed.includes("</") ||
          trimmed.startsWith("<html") ||
          trimmed.startsWith("<!DOCTYPE"))
      );
    }

    private isUrlContent(content: string): boolean {
      try {
        new URL(content);
        return true;
      } catch {
        return false;
      }
    }

    isActiveElementPasteable(): boolean {
      const activeElement = document.activeElement as HTMLElement | null;
      logger.debug(
        "🔍 Checking if active element is pasteable:",
        activeElement?.tagName
      );

      if (!activeElement) {
        return false;
      }

      if (
        activeElement.tagName === "INPUT" ||
        activeElement.tagName === "TEXTAREA"
      ) {
        const inputElement = activeElement as
          | HTMLInputElement
          | HTMLTextAreaElement;
        return !inputElement.disabled && !inputElement.readOnly;
      }

      return activeElement.isContentEditable;
    }

    getActiveElementInfo(): {
      tagName: string;
      type: string;
      canPaste: boolean;
      selectionStart?: number;
      selectionEnd?: number;
    } | null {
      const activeElement = document.activeElement as HTMLElement | null;

      if (!activeElement) {
        return null;
      }

      const info = {
        tagName: activeElement.tagName,
        type: "unknown",
        canPaste: this.isActiveElementPasteable(),
      };

      if (activeElement.tagName === "INPUT") {
        const inputElement = activeElement as HTMLInputElement;
        return {
          ...info,
          type: inputElement.type || "text",
          selectionStart: inputElement.selectionStart || 0,
          selectionEnd: inputElement.selectionEnd || 0,
        };
      }

      if (activeElement.tagName === "TEXTAREA") {
        const textareaElement = activeElement as HTMLTextAreaElement;
        return {
          ...info,
          type: "textarea",
          selectionStart: textareaElement.selectionStart || 0,
          selectionEnd: textareaElement.selectionEnd || 0,
        };
      }

      if (activeElement.isContentEditable) {
        return {
          ...info,
          type: "contenteditable",
        };
      }

      return info;
    }
  }

  // Main Content Script Class
  class ContentScriptMain {
    private pasteHandler: PasteHandler;

    constructor() {
      logger.info("🎯 ContentScriptMain initializing...", {
        url: window.location.href,
        title: document.title,
      });
      this.pasteHandler = new PasteHandler();
      this.initialize();
      logger.info("✅ ContentScriptMain initialized successfully", {});
    }

    initialize(): void {
      logger.info("📡 Setting up message listener...", {});

      browserAPI.runtime.onMessage.addListener(
        (message: any, _sender: any, sendResponse: (response: any) => void) => {
          logger.info("📨 Content script received message:", {
            action: message.action,
            hasContent: !!message.content,
            contentType: message.contentType,
            contentLength: message.content?.length || 0,
          });

          this.handleMessage(message, _sender, sendResponse);
          return true;
        }
      );

      const activeElement = document.activeElement as HTMLElement | null;
      logger.info("🌐 Content script loaded on page:", {
        url: window.location.href,
        title: document.title,
        activeElementTag: activeElement?.tagName,
        isContentEditable: activeElement?.isContentEditable,
        readyState: document.readyState,
      });

      if (document.readyState !== "complete") {
        window.addEventListener("load", () => {
          logger.info("🔄 Page fully loaded, content script ready", {});
        });
      }
    }

    async handleMessage(
      message: any,
      _sender: any,
      sendResponse: (response: any) => void
    ): Promise<void> {
      const startTime = Date.now();
      logger.info(`🔄 Processing message action: ${message.action}`, {});

      try {
        switch (message.action) {
          case "ping":
            logger.info("🏓 Responding to ping", {});
            sendResponse({ success: true, timestamp: Date.now() });
            break;

          case "pasteClipboardItem":
          case "pasteDirectValue":
            await this.handlePasteRequest(message, sendResponse);
            break;

          case "getActiveElementInfo":
            const elementInfo = this.pasteHandler.getActiveElementInfo();
            logger.info("📍 Returning active element info:", elementInfo);
            sendResponse({ success: true, elementInfo });
            break;

          case "checkPasteability":
            const canPaste = this.pasteHandler.isActiveElementPasteable();
            logger.info(`✅ Element pasteable: ${canPaste}`, {});
            sendResponse({ success: true, canPaste });
            break;

          case "showAlert":
            logger.info(`🚨 Showing alert: ${message.message}`, {});
            alert(message.message);
            sendResponse({ success: true });
            break;

          default:
            logger.warn(`❓ Unknown action: ${message.action}`, {});
            sendResponse({
              success: false,
              error: `Unknown action: ${message.action}`,
            });
        }

        const duration = Date.now() - startTime;
        logger.info(`⏱️ Message processing completed in ${duration}ms`, {});
      } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`💥 Content script error after ${duration}ms:`, error);

        const errorMessage =
          error instanceof Error ? error.message : String(error);
        sendResponse({
          success: false,
          error: errorMessage,
          duration,
        });
      }
    }

    async handlePasteRequest(
      message: any,
      sendResponse: (response: any) => void
    ): Promise<void> {
      logger.info(`📋 Handling paste request:`, {
        hasContent: !!message.content,
        contentLength: message.content?.length || 0,
        contentType: message.contentType || "unknown",
        itemId: message.itemId,
      });

      if (!message.content || typeof message.content !== "string") {
        logger.error("❌ Invalid content in paste request", {});
        sendResponse({
          success: false,
          error: "Invalid or missing content",
        });
        return;
      }

      if (message.content.length === 0) {
        logger.warn("⚠️ Empty content provided", {});
        sendResponse({
          success: false,
          error: "Content is empty",
        });
        return;
      }

      const activeElement = document.activeElement as HTMLElement | null;
      logger.info("🎯 Current active element before paste:", {
        hasElement: !!activeElement,
        tagName: activeElement?.tagName,
        type: (activeElement as HTMLInputElement)?.type,
        isContentEditable: activeElement?.isContentEditable,
        id: activeElement?.id || "no-id",
        className: activeElement?.className || "no-class",
        disabled: (activeElement as HTMLInputElement)?.disabled,
        readOnly: (activeElement as HTMLInputElement)?.readOnly,
        innerHTML: activeElement?.innerHTML?.substring(0, 100) || "none",
        role: activeElement?.getAttribute("role") || "none",
      });

      if (document.readyState === "loading") {
        logger.warn("⚠️ Document still loading, waiting...", {});
        await new Promise<void>((resolve) => {
          if (document.readyState === "complete") {
            resolve();
          } else {
            document.addEventListener("DOMContentLoaded", () => resolve(), {
              once: true,
            });
          }
        });
      }

      try {
        const pasteSuccess = await this.pasteHandler.pasteContent(
          message.content,
          message.contentType
        );

        logger.info(
          `📝 Paste operation result: ${pasteSuccess ? "SUCCESS" : "FAILED"}`,
          {}
        );

        if (pasteSuccess) {
          const postPasteElement = document.activeElement as HTMLElement | null;
          const verification = this.verifyPasteSuccess(
            message.content,
            postPasteElement
          );

          sendResponse({
            success: true,
            itemId: message.itemId,
            verification: verification,
          });
        } else {
          sendResponse({
            success: false,
            error:
              "Paste operation failed - no suitable element found or content could not be inserted",
            activeElementInfo: this.pasteHandler.getActiveElementInfo(),
          });
        }
      } catch (error) {
        logger.error("💥 Paste operation threw error:", error);
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : "Unknown paste error",
          activeElementInfo: this.pasteHandler.getActiveElementInfo(),
        });
      }
    }

    verifyPasteSuccess(
      expectedContent: string,
      element: HTMLElement | null
    ): {
      verified: boolean;
      reason: string;
      actualLength?: number;
      expectedLength?: number;
      elementType?: string;
      error?: string;
    } {
      if (!element) return { verified: false, reason: "no_element" };

      try {
        let actualContent = "";

        if (
          element instanceof HTMLInputElement ||
          element instanceof HTMLTextAreaElement
        ) {
          actualContent = element.value;
        } else if (element.isContentEditable) {
          actualContent = element.textContent || element.innerText || "";
        }

        const contentMatches = actualContent.includes(
          expectedContent.substring(0, 100)
        );

        return {
          verified: contentMatches,
          reason: contentMatches ? "content_found" : "content_not_found",
          actualLength: actualContent.length,
          expectedLength: expectedContent.length,
          elementType: element.tagName.toLowerCase(),
        };
      } catch (error) {
        return {
          verified: false,
          reason: "verification_error",
          error: error instanceof Error ? error.message : "unknown",
        };
      }
    }
  }

  // Initialize content script
  logger.info("🚀 Starting ContentScriptMain...", {});
  try {
    new ContentScriptMain();
  } catch (error) {
    logger.error("💥 Failed to initialize ContentScriptMain:", error);
  }
})();
