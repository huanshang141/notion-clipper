(() => {
  try {
    const rootKey = 'notion_clipper_data';
    const fallbackTheme: 'light' | 'dark' =
      window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';

    const setTheme = (theme: unknown) => {
      const resolved = theme === 'dark' || theme === 'light' ? theme : fallbackTheme;
      document.documentElement.setAttribute('data-theme', resolved);
    };

    if (!chrome?.storage?.sync) {
      setTheme(undefined);
      return;
    }

    chrome.storage.sync.get([rootKey], (result) => {
      const data = result?.[rootKey] || {};
      setTheme(data?.settings?.theme);
    });
  } catch {
    const fallbackTheme: 'light' | 'dark' =
      window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
    document.documentElement.setAttribute('data-theme', fallbackTheme);
  }
})();
