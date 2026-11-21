import type { StatusResource } from "@pokemon-memory-reader/api/schemas";
import type { AdaptersBody } from "@pokemon-memory-reader/internal/adapters-route";
import type { SettingsBody } from "@pokemon-memory-reader/internal/settings-route";
import { type ReactNode, useEffect, useState } from "react";
import {
  forgetPick,
  type ManualPicksBody,
  pickProfile,
  probeAdapters,
  putSettings,
  refusalCopy,
  switchAdapter,
} from "./internal-api";
import { ManualPickSection } from "./ManualPick";
import {
  ADAPTER_KEYS,
  ADAPTER_LABELS,
  type AdapterKey,
  type AdapterPin,
  changesUpdateCheck,
  type Draft,
  draftFrom,
  type FieldId,
  fieldLocked,
  isLanHost,
  POLL_HZ_RANGE,
  patchFrom,
  portChanged,
  savesBanner,
  sourceLabel,
  validate,
} from "./settings-form";
import {
  type Polled,
  UPDATE_REFRESH_EVENT,
  useAdapters,
  useManualPicks,
  useSettings,
} from "./useInternal";

type Source = "flag" | "file" | "default";

/** One message under the form: what a write did, or why the program refused it. */
export type Notice =
  | { readonly kind: "ok"; readonly message: string }
  | {
      readonly kind: "error";
      readonly title: string | null;
      readonly message: string;
    };

const refusal = (outcome: {
  code: string | null;
  message: string;
}): Notice => ({ kind: "error", ...refusalCopy(outcome) });

export function NoticeView({ notice }: { notice: Notice | null }) {
  if (notice === null) return null;
  return notice.kind === "ok" ? (
    <p className="notice notice-ok" role="status">
      {notice.message}
    </p>
  ) : (
    <div className="notice notice-error" role="alert">
      {notice.title ? <strong>{notice.title}. </strong> : null}
      {notice.message}
    </div>
  );
}

function Field({
  id,
  label,
  source,
  locked,
  restart = false,
  pending,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  source: Source;
  locked: boolean;
  restart?: boolean;
  pending?: string | undefined;
  error?: string | undefined;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="setting">
      <label className="setting-label" htmlFor={id}>
        {label}
      </label>
      {children}
      <p className="footnote muted" id={`${id}-note`}>
        {sourceLabel(source)}.
        {locked ? " It can't change here while the flag is set." : ""}
        {restart ? " Restart to apply." : ""}
        {pending !== undefined
          ? ` Saved as ${pending}, which applies after a restart.`
          : ""}
      </p>
      {hint ? <p className="footnote">{hint}</p> : null}
      {error ? (
        <p className="field-error" id={`${id}-error`} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function TextInput({
  id,
  value,
  onChange,
  locked,
  error,
  inputMode,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  locked: boolean;
  error: string | undefined;
  inputMode?: "numeric";
}) {
  return (
    <input
      id={id}
      className="input"
      type="text"
      inputMode={inputMode}
      value={value}
      disabled={locked}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? `${id}-note ${id}-error` : `${id}-note`}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function ToggleInput({
  id,
  text,
  checked,
  onChange,
  locked,
}: {
  id: string;
  text: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  locked: boolean;
}) {
  return (
    <label className="toggle" htmlFor={id}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={locked}
        aria-describedby={`${id}-note`}
        onChange={(event) => onChange(event.target.checked)}
      />
      {text}
    </label>
  );
}

const PROBE_TEXT: Readonly<Record<string, string>> = {
  live: "Connected",
  usable: "Ready",
  busy: "In use by another program",
  refused: "Refused the connection",
  no_reply: "No reply",
  problem: "Answered, but not usable",
  not_probed: "Not checked",
};

const PROBLEM_TEXT: Readonly<Record<string, string>> = {
  unknown_bridge: "an unknown bridge answered",
  protocol_mismatch: "the bridge is the wrong version",
  bridge_error: "the bridge reported an error",
};

/** The adapter list and the run-only switch (amendment 021, items 5 to 7). */
export function AdapterList({
  adapters,
  busy,
  onProbe,
  onSwitch,
}: {
  adapters: Polled<AdaptersBody>;
  busy: boolean;
  onProbe: () => void;
  onSwitch: (id: AdapterKey) => void;
}) {
  if (adapters.kind === "loading")
    return <p className="body muted">Looking for emulators.</p>;
  if (adapters.kind === "unavailable")
    return (
      <p className="body muted" role="alert">
        The adapter list can't be read right now. {adapters.message}
      </p>
    );
  const { mode, adapters: list } = adapters.value;
  const pinned = mode === "pinned";
  return (
    <>
      <ul className="adapter-list">
        {list.map((adapter) => {
          const { result, problem } = adapter.probe;
          const key = adapter.id as AdapterKey;
          return (
            <li key={adapter.id} className="adapter-row">
              <div>
                <strong>{ADAPTER_LABELS[key] ?? adapter.id}</strong>
                <span className="footnote muted">
                  {" "}
                  {adapter.endpoint.host}:{adapter.endpoint.port}
                </span>
                <p className="footnote">
                  {PROBE_TEXT[result] ?? result}
                  {problem ? `: ${PROBLEM_TEXT[problem] ?? problem}` : ""}
                </p>
              </div>
              {result === "usable" && !adapter.live ? (
                <button
                  type="button"
                  className="button button-quiet"
                  disabled={busy || pinned}
                  onClick={() => onSwitch(key)}
                >
                  Switch to {ADAPTER_LABELS[key]}
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
      {pinned ? (
        <p className="footnote muted">
          Pinned to one adapter. Set the pin to Auto and save to switch or check
          again.
        </p>
      ) : (
        <>
          <button
            type="button"
            className="button button-quiet"
            disabled={busy}
            onClick={onProbe}
          >
            Check again
          </button>
          <p className="footnote muted">
            A switch lasts until the program restarts. Pin an adapter above to
            keep it.
          </p>
        </>
      )}
    </>
  );
}

const PIN_OPTIONS: readonly AdapterPin[] = ["auto", ...ADAPTER_KEYS];

export function SettingsForm({
  body,
  draft,
  errors,
  onChange,
  onSave,
  onDiscard,
  dirty,
  saving,
}: {
  body: SettingsBody;
  draft: Draft;
  errors: Partial<Record<FieldId, string>>;
  onChange: (draft: Draft) => void;
  onSave: () => void;
  onDiscard: () => void;
  dirty: boolean;
  saving: boolean;
}) {
  const { settings } = body;
  const locked = (field: FieldId) => fieldLocked(settings, field);
  const pending = <T,>(entry: { pending?: T | undefined }) =>
    entry.pending === undefined ? undefined : String(entry.pending);
  const lan = isLanHost(draft.host);
  return (
    <form
      className="settings-form"
      onSubmit={(event) => {
        event.preventDefault();
        onSave();
      }}
    >
      <section className="card" aria-labelledby="set-connection">
        <h3 className="headline" id="set-connection">
          Program address
        </h3>
        <Field
          id="set-host"
          label="Bind address"
          source={settings.host.source}
          locked={locked("host")}
          restart
          pending={pending(settings.host)}
          error={errors.host}
          hint={
            lan ? (
              <span className="warning">
                Other devices on your network can read your game data at this
                address. Use 127.0.0.1 to keep it on this computer.
              </span>
            ) : null
          }
        >
          <TextInput
            id="set-host"
            value={draft.host}
            locked={locked("host")}
            error={errors.host}
            onChange={(host) => onChange({ ...draft, host })}
          />
        </Field>
        <Field
          id="set-port"
          label="Port"
          source={settings.port.source}
          locked={locked("port")}
          restart
          pending={pending(settings.port)}
          error={errors.port}
          hint={
            portChanged(settings, draft) ? (
              <span className="warning">
                Changing the port means overlays that use the default address
                need the new URL.
              </span>
            ) : null
          }
        >
          <TextInput
            id="set-port"
            inputMode="numeric"
            value={draft.port}
            locked={locked("port")}
            error={errors.port}
            onChange={(port) => onChange({ ...draft, port })}
          />
        </Field>
        <Field
          id="set-open"
          label="Browser"
          source={settings.openBrowser.source}
          locked={locked("openBrowser")}
          restart
          pending={pending(settings.openBrowser)}
          error={undefined}
        >
          <ToggleInput
            id="set-open"
            text="Open the viewer in a browser when the program starts"
            checked={draft.openBrowser}
            locked={locked("openBrowser")}
            onChange={(openBrowser) => onChange({ ...draft, openBrowser })}
          />
        </Field>
      </section>

      <section className="card" aria-labelledby="set-adapters">
        <h3 className="headline" id="set-adapters">
          Emulator connection
        </h3>
        <Field
          id="set-adapter"
          label="Adapter"
          source={settings.adapter.source}
          locked={locked("adapter")}
          error={undefined}
        >
          <select
            id="set-adapter"
            className="input"
            value={draft.adapter}
            disabled={locked("adapter")}
            aria-describedby="set-adapter-note"
            onChange={(event) =>
              onChange({ ...draft, adapter: event.target.value as AdapterPin })
            }
          >
            {PIN_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option === "auto"
                  ? "Auto, try each in turn"
                  : `Pin to ${ADAPTER_LABELS[option]}`}
              </option>
            ))}
          </select>
        </Field>
        {ADAPTER_KEYS.map((key) => (
          <fieldset key={key} className="endpoint">
            <legend className="subheadline">{ADAPTER_LABELS[key]}</legend>
            <Field
              id={`set-${key}-host`}
              label="Host"
              source={settings.adapters.source}
              locked={locked(`${key}.host`)}
              error={errors[`${key}.host`]}
            >
              <TextInput
                id={`set-${key}-host`}
                value={draft.endpoints[key].host}
                locked={locked(`${key}.host`)}
                error={errors[`${key}.host`]}
                onChange={(host) =>
                  onChange({
                    ...draft,
                    endpoints: {
                      ...draft.endpoints,
                      [key]: { ...draft.endpoints[key], host },
                    },
                  })
                }
              />
            </Field>
            <Field
              id={`set-${key}-port`}
              label="Port"
              source={settings.adapters.source}
              locked={locked(`${key}.port`)}
              error={errors[`${key}.port`]}
              hint={
                key === "retroarch"
                  ? null
                  : "Reload the bridge in the emulator after changing this."
              }
            >
              <TextInput
                id={`set-${key}-port`}
                inputMode="numeric"
                value={draft.endpoints[key].port}
                locked={locked(`${key}.port`)}
                error={errors[`${key}.port`]}
                onChange={(port) =>
                  onChange({
                    ...draft,
                    endpoints: {
                      ...draft.endpoints,
                      [key]: { ...draft.endpoints[key], port },
                    },
                  })
                }
              />
            </Field>
          </fieldset>
        ))}
      </section>

      <section className="card" aria-labelledby="set-updates">
        <h3 className="headline" id="set-updates">
          Updates
        </h3>
        <Field
          id="set-update-check"
          label="Update check"
          source={settings.updateCheck.source}
          locked={locked("updateCheck")}
          error={undefined}
        >
          <ToggleInput
            id="set-update-check"
            text="Look for a newer release once a day"
            checked={draft.updateCheck}
            locked={locked("updateCheck")}
            onChange={(updateCheck) => onChange({ ...draft, updateCheck })}
          />
        </Field>
      </section>

      <details className="card advanced">
        <summary className="headline">Advanced</summary>
        <Field
          id="set-poll"
          label="Poll rate (reads per second)"
          source={settings.pollHz.source}
          locked={locked("pollHz")}
          error={errors.pollHz}
          hint={`From ${POLL_HZ_RANGE.min} to ${POLL_HZ_RANGE.max}.`}
        >
          <TextInput
            id="set-poll"
            inputMode="numeric"
            value={draft.pollHz}
            locked={locked("pollHz")}
            error={errors.pollHz}
            onChange={(pollHz) => onChange({ ...draft, pollHz })}
          />
        </Field>
      </details>

      <div className="form-actions">
        <button type="submit" className="button" disabled={!dirty || saving}>
          {saving ? "Saving" : "Save changes"}
        </button>
        <button
          type="button"
          className="button button-quiet"
          disabled={!dirty || saving}
          onClick={onDiscard}
        >
          Discard
        </button>
      </div>
    </form>
  );
}

/** The folders the program uses, shown only to a reader on this computer (amendment 021, item 13). */
export function PathsSection({ paths }: { paths: SettingsBody["paths"] }) {
  if (paths === null) {
    return (
      <section className="card" aria-labelledby="set-paths">
        <h3 className="headline" id="set-paths">
          Paths
        </h3>
        <p className="body muted">
          Open the viewer on this machine to see the path.
        </p>
      </section>
    );
  }
  const rows: [string, string][] = [
    ["Data folder", paths.dataFolder],
    ["Config file", paths.configFile],
    ["Profiles folder", paths.profiles],
    ["Bridges folder", paths.bridges],
  ];
  return (
    <section className="card" aria-labelledby="set-paths">
      <h3 className="headline" id="set-paths">
        Paths
      </h3>
      <dl className="paths">
        {rows.map(([name, value]) => (
          <div key={name}>
            <dt>{name}</dt>
            <dd className="tabular">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** Everything on the screen, given what the controller loaded. No state of its own beyond what's passed in. */
export function SettingsView({
  body,
  draft,
  errors,
  dirty,
  saving,
  notice,
  adapters,
  adapterBusy,
  picks,
  status,
  pickBusy,
  onChange,
  onSave,
  onDiscard,
  onProbe,
  onSwitch,
  onPick,
  onForget,
}: {
  body: SettingsBody;
  draft: Draft;
  errors: Partial<Record<FieldId, string>>;
  dirty: boolean;
  saving: boolean;
  notice: Notice | null;
  adapters: Polled<AdaptersBody>;
  adapterBusy: boolean;
  picks: Polled<ManualPicksBody> | null;
  status: StatusResource | null;
  pickBusy: boolean;
  onChange: (draft: Draft) => void;
  onSave: () => void;
  onDiscard: () => void;
  onProbe: () => void;
  onSwitch: (id: AdapterKey) => void;
  onPick: (profileId: string, scope: "rom" | "base") => void;
  onForget: () => void;
}) {
  const banner = savesBanner(body);
  return (
    <div className="stack">
      <h2 className="title-1">Settings</h2>
      {banner ? (
        <p className="notice notice-error" role="alert">
          {banner}
        </p>
      ) : null}
      <NoticeView notice={notice} />
      <SettingsForm
        body={body}
        draft={draft}
        errors={errors}
        dirty={dirty}
        saving={saving}
        onChange={onChange}
        onSave={onSave}
        onDiscard={onDiscard}
      />
      <section className="card" aria-labelledby="set-live">
        <h3 className="headline" id="set-live">
          Adapters now
        </h3>
        <AdapterList
          adapters={adapters}
          busy={adapterBusy}
          onProbe={onProbe}
          onSwitch={onSwitch}
        />
      </section>
      <ManualPickSection
        status={status}
        picks={picks}
        busy={pickBusy}
        onPick={onPick}
        onForget={onForget}
      />
      <PathsSection paths={body.paths} />
    </div>
  );
}

/** The Settings screen: loads the settings, the adapter list and the pick candidates, and runs the writes. */
export function SettingsScreen({ status }: { status: StatusResource | null }) {
  const settings = useSettings(true);
  const adapters = useAdapters(true);
  const pickable =
    status?.state === "unidentified" ||
    (status?.state === "game" && status.game?.match === "manual");
  const picks = useManualPicks(pickable);
  const reloadPicks = picks.reload;
  const pickState = `${status?.state}|${status?.rom?.crc32}|${status?.game?.match}|${status?.game?.profileId}`;
  // biome-ignore lint/correctness/useExhaustiveDependencies: a changed identification re-reads the candidates (amendment 021, item 8)
  useEffect(() => reloadPicks(), [pickState, reloadPicks]);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState<"save" | "probe" | "switch" | "pick" | null>(
    null,
  );
  const loaded = settings.state.kind === "ready" ? settings.state.value : null;
  // The form starts from the first read and only changes again on a save or a discard, so a poll
  // never overwrites what is being typed.
  useEffect(() => {
    if (loaded !== null)
      setDraft((current) => current ?? draftFrom(loaded.settings));
  }, [loaded]);

  if (settings.state.kind === "loading" || loaded === null || draft === null) {
    return settings.state.kind === "unavailable" ? (
      <>
        <h2 className="title-1">Settings</h2>
        <p className="notice notice-error" role="alert">
          Settings can't be read right now. {settings.state.message}
        </p>
      </>
    ) : (
      <>
        <h2 className="title-1">Settings</h2>
        <p className="body muted">Reading the settings.</p>
      </>
    );
  }

  const errors = validate(loaded.settings, draft);
  const patch = patchFrom(loaded.settings, draft);
  const dirty = Object.keys(patch).length > 0;

  const save = async () => {
    if (Object.keys(errors).length > 0 || !dirty) return;
    setBusy("save");
    const outcome = await putSettings(patch);
    setBusy(null);
    if (!outcome.ok) return setNotice(refusal(outcome));
    settings.set(outcome.value);
    setDraft(draftFrom(outcome.value.settings));
    setNotice({ kind: "ok", message: "Saved." });
    if (changesUpdateCheck(patch))
      window.dispatchEvent(new Event(UPDATE_REFRESH_EVENT));
    adapters.reload();
  };
  const probe = async () => {
    setBusy("probe");
    const outcome = await probeAdapters();
    setBusy(null);
    if (!outcome.ok) return setNotice(refusal(outcome));
    adapters.set(outcome.value);
    setNotice(null);
  };
  const switchTo = async (id: AdapterKey) => {
    setBusy("switch");
    const outcome = await switchAdapter(id);
    setBusy(null);
    if (!outcome.ok) return setNotice(refusal(outcome));
    adapters.reload();
    setNotice({
      kind: "ok",
      message: `Now reading from ${ADAPTER_LABELS[id]}, until the program restarts.`,
    });
  };
  const pick = async (profileId: string, scope: "rom" | "base") => {
    setBusy("pick");
    const outcome = await pickProfile({ profileId, scope });
    setBusy(null);
    if (!outcome.ok) return setNotice(refusal(outcome));
    reloadPicks();
    setNotice({
      kind: "ok",
      message: outcome.value.saved
        ? "Profile picked and remembered for this ROM."
        : outcome.value.reason === "no_key"
          ? "Profile picked for this session. This ROM has nothing to remember it by, so it won't be remembered."
          : "Profile picked for this session. The pick couldn't be saved to disk, so it won't be remembered.",
    });
  };
  const forget = async () => {
    setBusy("pick");
    const outcome = await forgetPick();
    setBusy(null);
    if (!outcome.ok) return setNotice(refusal(outcome));
    reloadPicks();
    setNotice({
      kind: "ok",
      message: "Pick forgotten. The ROM was identified again.",
    });
  };

  return (
    <SettingsView
      body={loaded}
      draft={draft}
      errors={errors}
      dirty={dirty}
      saving={busy === "save"}
      notice={notice}
      adapters={adapters.state}
      adapterBusy={busy === "probe" || busy === "switch"}
      picks={pickable ? picks.state : null}
      status={status}
      pickBusy={busy === "pick"}
      onChange={setDraft}
      onSave={() => void save()}
      onDiscard={() => {
        setDraft(draftFrom(loaded.settings));
        setNotice(null);
      }}
      onProbe={() => void probe()}
      onSwitch={(id) => void switchTo(id)}
      onPick={(profileId, scope) => void pick(profileId, scope)}
      onForget={() => void forget()}
    />
  );
}
