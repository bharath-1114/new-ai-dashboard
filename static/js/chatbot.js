(function () {

  const chatMessages = document.getElementById("chatMessages");
  const chatInput = document.getElementById("chatInput");
  const chatSend = document.getElementById("chatSend");

  if (!chatMessages || !chatInput || !chatSend) return;

  function addMessage(text, sender = "bot") {
    const div = document.createElement("div");
    div.className = "chat-msg " + sender;
    div.textContent = text;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function hasAny(q, words) {
    return words.some(w => q.includes(w));
  }

  function chatbotReply(question) {
    const q = question.toLowerCase();

    if (hasAny(q, ["hi", "hello", "hey"])) {
      return "Hi 👋 Ask me about rows, columns, attendance, marks, or gender.";
    }

    if (!window.ChatbotKnowledge?.rows) {
      return "Please upload a dataset first 📂";
    }

    const kb = window.ChatbotKnowledge;

    if (hasAny(q, ["rows", "records", "count"])) {
      return `Dataset contains ${kb.rows} records.`;
    }

    if (hasAny(q, ["columns", "fields"])) {
      return `Dataset has ${kb.columns.length} columns.`;
    }

    if (hasAny(q, ["numeric"])) {
      return kb.numericCols.length
        ? `Numeric columns: ${kb.numericCols.join(", ")}`
        : "No numeric columns detected.";
    }

    if (hasAny(q, ["attendance"])) {
      return kb.avgAttendance
        ? `Average attendance is ${kb.avgAttendance}%.`
        : "Attendance column not detected.";
    }

    if (hasAny(q, ["marks", "score", "percentage"])) {
      return kb.avgScore
        ? `Average score is ${kb.avgScore}.`
        : "Score column not detected.";
    }

    if (hasAny(q, ["gender"])) {
      return "Gender distribution is available in the dashboard 📊";
    }

    return "I didn’t understand that 🤔 Try asking about rows, attendance, or marks.";
  }

  chatSend.onclick = () => {
    const q = chatInput.value.trim();
    if (!q) return;

    addMessage(q, "user");
    addMessage(chatbotReply(q), "bot");

    chatInput.value = "";
  };

})();
