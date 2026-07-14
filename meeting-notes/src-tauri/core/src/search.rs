/// Case-insensitive substring match against a note's title and body.
///
/// An empty (or whitespace-only) query matches everything.
pub fn note_matches(title: &str, body: &str, query: &str) -> bool {
    let q = query.trim().to_lowercase();
    if q.is_empty() {
        return true;
    }
    title.to_lowercase().contains(&q) || body.to_lowercase().contains(&q)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn matches_in_title_case_insensitive() {
        assert!(note_matches("Weekly Sync", "body", "weekly"));
        assert!(note_matches("Weekly Sync", "body", "SYNC"));
    }

    #[test]
    fn matches_in_body() {
        assert!(note_matches("t", "Discuss the Q3 roadmap", "roadmap"));
    }

    #[test]
    fn no_match() {
        assert!(!note_matches("Weekly Sync", "agenda items", "budget"));
    }

    #[test]
    fn empty_query_matches_all() {
        assert!(note_matches("anything", "", ""));
        assert!(note_matches("anything", "", "   "));
    }
}
