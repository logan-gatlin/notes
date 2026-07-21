import { useCallback, useEffect, useMemo, useState } from "react";
import { Modal } from "./Modal";
import type { AiAuthStatus } from "../lib/types";
import {
  aiAuthStatus,
  aiListModels,
  aiLogin,
  getAiConfig,
  setAiConfig,
} from "../lib/tauri";

interface Props {
  onClose: () => void;
}

const DEFAULT_BASE_URL = "https://opencode.cloudflare.dev";
const DEFAULT_MODEL = "claude-sonnet-4-6";

/** Shown in the dropdown before the live list is fetched from the gateway. */
const FALLBACK_MODELS = [
  "claude-sonnet-4-6",
  "claude-opus-4-8",
  "claude-opus-4-7",
  "claude-opus-4-6",
];

/** Configure the Cloudflare AI Gateway connection and sign in via Access. */
export function AiSettingsModal({ onClose }: Props) {
  const [baseUrl, setBaseUrl] = useState(DEFAULT_BASE_URL);
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [gatewayToken, setGatewayToken] = useState("");
  const [status, setStatus] = useState<AiAuthStatus | null>(null);
  const [models, setModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [signingIn, setSigningIn] = useState(false);

  const refreshStatus = () => {
    aiAuthStatus()
      .then(setStatus)
      .catch(() => setStatus(null));
  };

  useEffect(() => {
    (async () => {
      try {
        const cfg = await getAiConfig();
        if (cfg) {
          setBaseUrl(cfg.baseUrl || DEFAULT_BASE_URL);
          setModel(cfg.model || DEFAULT_MODEL);
          setGatewayToken(cfg.gatewayToken ?? "");
        }
      } catch (e) {
        setError(String(e));
      }

      let st: AiAuthStatus | null = null;
      try {
        st = await aiAuthStatus();
        setStatus(st);
      } catch {
        setStatus(null);
      }

      // Populate the dropdown from the gateway only when a valid session
      // already exists, so opening settings never forces a browser login.
      if (st?.signedIn && st.configured) {
        try {
          const list = await aiListModels();
          if (list.length > 0) {
            setModels(list);
            reconcileModel(list);
          }
        } catch {
          /* best-effort: fall back to the static list */
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    if (!baseUrl.trim()) {
      setError("Gateway base URL is required.");
      return;
    }
    if (!model.trim()) {
      setError("Model is required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await setAiConfig({
        baseUrl: baseUrl.trim().replace(/\/+$/, ""),
        model: model.trim(),
        gatewayToken: gatewayToken.trim() || null,
      });
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const signIn = async () => {
    // Persist current settings first so the login targets the right gateway.
    if (!baseUrl.trim()) {
      setError("Enter the gateway base URL before signing in.");
      return;
    }
    setSigningIn(true);
    setError(null);
    try {
      await setAiConfig({
        baseUrl: baseUrl.trim().replace(/\/+$/, ""),
        model: model.trim() || DEFAULT_MODEL,
        gatewayToken: gatewayToken.trim() || null,
      });
      await aiLogin();
      refreshStatus();
    } catch (e) {
      setError(String(e));
    } finally {
      setSigningIn(false);
    }
  };

  // If the selected model isn't offered by the gateway (e.g. a stale value from
  // an earlier version), switch to the default (or first) valid model.
  const reconcileModel = (list: string[]) => {
    setModel((cur) =>
      list.includes(cur)
        ? cur
        : list.includes(DEFAULT_MODEL)
          ? DEFAULT_MODEL
          : (list[0] ?? cur),
    );
  };

  const loadModels = useCallback(async () => {
    if (!baseUrl.trim()) {
      setError("Enter the gateway base URL before loading models.");
      return;
    }
    setLoadingModels(true);
    setError(null);
    try {
      await setAiConfig({
        baseUrl: baseUrl.trim().replace(/\/+$/, ""),
        model: model.trim() || DEFAULT_MODEL,
        gatewayToken: gatewayToken.trim() || null,
      });
      const list = await aiListModels();
      setModels(list);
      if (list.length === 0) {
        setError("The gateway returned no models.");
      } else {
        reconcileModel(list);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoadingModels(false);
    }
  }, [baseUrl, model, gatewayToken]);

  // Options for the dropdown: the fetched list (or a static fallback), always
  // including the currently-selected model so it never disappears.
  const modelOptions = useMemo(() => {
    const base = models.length > 0 ? models : FALLBACK_MODELS;
    const set = new Set(base);
    if (model.trim()) set.add(model.trim());
    return Array.from(set).sort();
  }, [models, model]);

  const inputCls =
    "bg-paper border border-line-strong text-ink placeholder-muted rounded-md px-2.5 py-1.5 outline-none focus:border-accent transition-colors font-mono text-xs";

  return (
    <Modal title="AI Settings" onClose={onClose}>
      <div className="flex flex-col gap-4 text-sm">
        <label className="flex flex-col gap-1.5">
          <span className="eyebrow">Gateway base URL</span>
          <input
            className={inputCls}
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder={DEFAULT_BASE_URL}
            autoFocus
          />
          <span className="text-muted text-[11px]">
            The opencode AI Gateway. Sign-in uses cloudflared, the same as{" "}
            <code>opencode auth login</code>.
          </span>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="eyebrow">Model</span>
          <div className="flex items-center gap-2">
            <select
              className={inputCls + " flex-1"}
              value={model}
              onChange={(e) => setModel(e.target.value)}
            >
              {modelOptions.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="shrink-0 px-2.5 py-1.5 rounded-md border border-line-strong text-ink-soft text-xs hover:bg-paper disabled:opacity-50 transition-colors"
              onClick={loadModels}
              disabled={loadingModels}
              title="Refresh the model list from the gateway"
            >
              {loadingModels ? "Loading…" : "Refresh"}
            </button>
          </div>
          <span className="text-muted text-[11px]">
            Anthropic models served by the gateway. Use “Refresh” to fetch the
            current list (requires sign-in).
          </span>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="eyebrow">Gateway token (optional)</span>
          <input
            className={inputCls}
            value={gatewayToken}
            onChange={(e) => setGatewayToken(e.target.value)}
            placeholder="cf-aig-authorization — usually not needed behind Access"
            type="password"
          />
        </label>

        <div className="flex items-center justify-between rounded-md border border-line-strong bg-paper px-3 py-2">
          <div className="flex flex-col gap-0.5 text-xs">
            <span className="eyebrow">Cloudflare Access</span>
            <span className="text-ink-soft">
              {status == null
                ? "Checking…"
                : !status.cloudflaredAvailable
                  ? "cloudflared not found on PATH"
                  : status.signedIn
                    ? "Signed in"
                    : "Not signed in"}
            </span>
          </div>
          <button
            className="px-3 py-1.5 rounded-md border border-line-strong text-ink-soft hover:bg-surface disabled:opacity-50 transition-colors"
            onClick={signIn}
            disabled={signingIn || (status != null && !status.cloudflaredAvailable)}
          >
            {signingIn ? "Opening browser…" : status?.signedIn ? "Re-sign in" : "Sign in"}
          </button>
        </div>

        {error && <div className="text-danger text-xs whitespace-pre-wrap">{error}</div>}

        <div className="flex justify-end gap-2 mt-1">
          <button
            className="px-3 py-1.5 rounded-md border border-line-strong text-ink-soft hover:bg-paper transition-colors"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="px-3 py-1.5 rounded-md bg-ink text-paper font-medium hover:bg-black disabled:opacity-50 transition-colors"
            onClick={save}
            disabled={busy}
          >
            Save
          </button>
        </div>
      </div>
    </Modal>
  );
}
