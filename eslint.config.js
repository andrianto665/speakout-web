export default [
  {
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: "script",
      globals: {
        window: "readonly",
        document: "readonly",
        console: "readonly",
        fetch: "readonly",
        localStorage: "readonly",
        sessionStorage: "readonly",
        navigator: "readonly",
        alert: "readonly",
        confirm: "readonly",
        setTimeout: "readonly",
        setInterval: "readonly",
        clearTimeout: "readonly",
        clearInterval: "readonly",
        AbortController: "readonly",
        URLSearchParams: "readonly",
        Notification: "readonly",
        MutationObserver: "readonly",
        SpeechSynthesisUtterance: "readonly",
        speechSynthesis: "readonly",
        module: "readonly",
        location: "readonly",
        history: "readonly",
      }
    },
    rules: {
      "no-unused-vars": "warn",
      "no-undef": "error"
    }
  }
];