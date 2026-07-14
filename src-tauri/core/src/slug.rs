use std::collections::HashSet;

/// Convert an arbitrary string into a filesystem-friendly slug.
///
/// Lowercases, replaces any run of non-alphanumeric characters with a single
/// `-`, and trims leading/trailing dashes. Empty results fall back to `note`.
pub fn slugify(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    let mut prev_dash = false;
    for ch in input.chars() {
        if ch.is_ascii_alphanumeric() {
            out.push(ch.to_ascii_lowercase());
            prev_dash = false;
        } else if ch.is_alphanumeric() {
            // Keep unicode letters/digits lowercased.
            for lc in ch.to_lowercase() {
                out.push(lc);
            }
            prev_dash = false;
        } else if !prev_dash {
            out.push('-');
            prev_dash = true;
        }
    }
    let trimmed = out.trim_matches('-').to_string();
    if trimmed.is_empty() {
        "note".to_string()
    } else {
        trimmed
    }
}

/// Build a note filename of the form `<date>-<slug>.md`, adding a numeric
/// suffix (`-2`, `-3`, ...) if the base name already exists in `existing`.
pub fn unique_filename(date_str: &str, title: &str, existing: &HashSet<String>) -> String {
    let slug = slugify(title);
    let base = format!("{date_str}-{slug}");
    let candidate = format!("{base}.md");
    if !existing.contains(&candidate) {
        return candidate;
    }
    let mut n = 2;
    loop {
        let candidate = format!("{base}-{n}.md");
        if !existing.contains(&candidate) {
            return candidate;
        }
        n += 1;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn slugify_basic() {
        assert_eq!(slugify("Weekly Sync"), "weekly-sync");
        assert_eq!(slugify("1:1 with Manager"), "1-1-with-manager");
        assert_eq!(slugify("Sprint   Planning!!!"), "sprint-planning");
        assert_eq!(slugify("  leading/trailing  "), "leading-trailing");
    }

    #[test]
    fn slugify_empty_fallback() {
        assert_eq!(slugify(""), "note");
        assert_eq!(slugify("---"), "note");
        assert_eq!(slugify("!@#$%"), "note");
    }

    #[test]
    fn unique_filename_no_collision() {
        let existing = HashSet::new();
        assert_eq!(
            unique_filename("2026-07-09", "Weekly Sync", &existing),
            "2026-07-09-weekly-sync.md"
        );
    }

    #[test]
    fn unique_filename_with_collisions() {
        let mut existing = HashSet::new();
        existing.insert("2026-07-09-weekly-sync.md".to_string());
        existing.insert("2026-07-09-weekly-sync-2.md".to_string());
        assert_eq!(
            unique_filename("2026-07-09", "Weekly Sync", &existing),
            "2026-07-09-weekly-sync-3.md"
        );
    }
}
