#[cfg(target_os = "macos")]
const SERVICE: &str = "com.paperview.app";

#[cfg(target_os = "macos")]
fn entry(account: &str) -> Result<keyring::Entry, String> {
    keyring::Entry::new(SERVICE, account).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn keychain_get(account: String) -> Result<Option<String>, String> {
    #[cfg(target_os = "macos")]
    {
        return match entry(&account)?.get_password() {
            Ok(value) => Ok(Some(value)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(error) => Err(error.to_string()),
        };
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = account;
        Err("The native keychain is only available in the macOS build.".into())
    }
}

#[tauri::command]
pub fn keychain_set(account: String, value: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        return entry(&account)?
            .set_password(&value)
            .map_err(|error| error.to_string());
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = (account, value);
        Err("The native keychain is only available in the macOS build.".into())
    }
}

#[tauri::command]
pub fn keychain_delete(account: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        return match entry(&account)?.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(error) => Err(error.to_string()),
        };
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = account;
        Err("The native keychain is only available in the macOS build.".into())
    }
}
