#[cfg(target_os = "macos")]
const SERVICE: &str = "com.paperview.app";
#[cfg(target_os = "macos")]
const ACCOUNT: &str = "openai-api-key";

#[cfg(target_os = "macos")]
fn entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new(SERVICE, ACCOUNT).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn keychain_get() -> Result<Option<String>, String> {
    #[cfg(target_os = "macos")]
    {
        match entry()?.get_password() {
            Ok(value) => Ok(Some(value)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(error) => Err(error.to_string()),
        }
    }

    #[cfg(not(target_os = "macos"))]
    {
        Err("The native keychain is only available in the macOS build.".into())
    }
}

#[tauri::command]
pub fn keychain_set(value: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        entry()?
            .set_password(&value)
            .map_err(|error| error.to_string())
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = value;
        Err("The native keychain is only available in the macOS build.".into())
    }
}

#[tauri::command]
pub fn keychain_delete() -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        match entry()?.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(error) => Err(error.to_string()),
        }
    }

    #[cfg(not(target_os = "macos"))]
    {
        Err("The native keychain is only available in the macOS build.".into())
    }
}
