export const PREFS_CHANGED_EVENT = "remindme:prefs-changed";

function read(key: string, fallback: boolean) {
  if (typeof window === "undefined") return fallback;
  const value = localStorage.getItem(key);
  return value === null ? fallback : value === "on";
}

function write(key: string, on: boolean) {
  localStorage.setItem(key, on ? "on" : "off");
  window.dispatchEvent(new Event(PREFS_CHANGED_EVENT));
}

export const getSoundEnabled = () => read("rm:sound", true);
export const setSoundEnabled = (on: boolean) => write("rm:sound", on);

export const getWakeLockEnabled = () => read("rm:wakelock", false);
export const setWakeLockEnabled = (on: boolean) => write("rm:wakelock", on);
