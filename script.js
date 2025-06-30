document.addEventListener("DOMContentLoaded", () => {
  const timerDisplay = document.getElementById("timer");
  const phaseDisplay = document.getElementById("phase");
  const startBtn = document.getElementById("start");
  const resetBtn = document.getElementById("reset");
  const progressCircle = document.getElementById("progress");

  const taskForm = document.getElementById("taskForm");
  const taskInput = document.getElementById("taskInput");
  const taskList = document.getElementById("taskList");

  const statsChartCtx = document.getElementById("statsChart").getContext("2d");
  const taskStatsChartCtx = document.getElementById("taskStatsChart").getContext("2d");

  const dailyCountEl = document.getElementById("dailyCount");

  const workDuration = 60 * 60;
  const shortBreak = 5 * 60;
  const longBreak = 15 * 60;

  let fullTime = workDuration;
  let timer = fullTime;
  let interval = null;
  let cycles = 0;
  let currentPhase = "Trabajo";
  let tasks = [];
  let activeTaskId = null;
  let globalChart = null;
  let taskChart = null;

  function updateDisplay() {
    const minutes = String(Math.floor(timer / 60)).padStart(2, "0");
    const seconds = String(timer % 60).padStart(2, "0");
    timerDisplay.textContent = `${minutes}:${seconds}`;
    document.title = `${minutes}:${seconds} - ${currentPhase}`;
    phaseDisplay.textContent = currentPhase;

    const radius = 70;
    const circumference = 2 * Math.PI * radius;
    const percent = timer / fullTime;
    progressCircle.style.strokeDasharray = circumference;
    progressCircle.style.strokeDashoffset = circumference * (1 - percent);
  }

  function setPhase(phase) {
    currentPhase = phase;
    fullTime = (phase === "Trabajo") ? workDuration : (phase === "Descanso corto" ? shortBreak : longBreak);
    timer = fullTime;
    updateDisplay();
  }

  function startTimer() {
    if (interval) return;
    interval = setInterval(() => {
      if (timer > 0) {
        timer--;
        updateDisplay();
      } else {
        clearInterval(interval);
        interval = null;
        handlePhaseCompletion();
      }
    }, 1000);
  }

  function resetTimer() {
    clearInterval(interval);
    interval = null;
    cycles = 0;
    setPhase("Trabajo");
    updateCharts();
  }

  function loadTasks() {
    tasks = JSON.parse(localStorage.getItem("pomodoroTasks") || "[]");
    activeTaskId = localStorage.getItem("activeTaskId") || null;
    renderTaskList();
  }

  function saveTasks() {
    localStorage.setItem("pomodoroTasks", JSON.stringify(tasks));
    localStorage.setItem("activeTaskId", activeTaskId);
  }

  function addTask(name) {
    tasks.push({
      id: Date.now().toString(),
      name,
      completed: false,
      pomodoros: 0
    });
    saveTasks();
    renderTaskList();
  }

  function toggleTaskCompletion(id) {
    const task = tasks.find(t => t.id === id);
    if (task) {
      task.completed = !task.completed;
      if (task.completed && activeTaskId === id) activeTaskId = null;
      saveTasks();
      renderTaskList();
    }
  }

  function deleteTask(id) {
    tasks = tasks.filter(t => t.id !== id);
    if (activeTaskId === id) activeTaskId = null;
    saveTasks();
    renderTaskList();
  }

  function setActiveTask(id) {
    activeTaskId = (activeTaskId === id) ? null : id;
    saveTasks();
    renderTaskList();
  }

  function renderTaskList() {
    taskList.innerHTML = "";
    if (tasks.length === 0) {
      taskList.innerHTML = "<li class='text-gray-400'>No hay tareas aún.</li>";
      return;
    }
    for (const task of tasks) {
      const li = document.createElement("li");
      li.className = "flex items-center justify-between p-2 border rounded";

      const left = document.createElement("div");
      left.className = "flex items-center gap-2";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = task.completed;
      checkbox.className = "w-5 h-5";
      checkbox.addEventListener("change", () => toggleTaskCompletion(task.id));

      const name = document.createElement("span");
      name.textContent = task.name;
      if (task.completed) name.classList.add("line-through", "text-gray-500");
      if (task.id === activeTaskId && !task.completed) name.classList.add("font-bold", "text-green-600");

      left.append(checkbox, name);

      const right = document.createElement("div");
      right.className = "flex items-center gap-2";

      const count = document.createElement("span");
      count.textContent = `🍅 ${task.pomodoros}`;
      count.className = "text-sm text-gray-600";

      const btn = document.createElement("button");
      btn.textContent = task.id === activeTaskId ? "Activo" : "Seleccionar";
      btn.className = task.id === activeTaskId ? "text-green-600 font-semibold" : "text-blue-600 hover:underline";
      btn.disabled = task.completed;
      btn.addEventListener("click", () => setActiveTask(task.id));

      const del = document.createElement("button");
      del.textContent = "✖";
      del.title = "Eliminar";
      del.className = "text-red-600 hover:text-red-800";
      del.addEventListener("click", () => deleteTask(task.id));

      right.append(count, btn, del);
      li.append(left, right);
      taskList.appendChild(li);
    }
  }

  function savePomodoroCompletion() {
    const today = new Date().toISOString().slice(0, 10);
    const stats = JSON.parse(localStorage.getItem("pomodoroStats") || "{}");
    stats[today] = (stats[today] || 0) + 1;
    localStorage.setItem("pomodoroStats", JSON.stringify(stats));
    updateDailyCount();
    updateGlobalChart();
  }

  function updateDailyCount() {
    const today = new Date().toISOString().slice(0, 10);
    const stats = JSON.parse(localStorage.getItem("pomodoroStats") || "{}");
    const count = stats[today] || 0;
    if (dailyCountEl) dailyCountEl.textContent = count;
  }

  function savePomodoroForActiveTask() {
    if (!activeTaskId) return;
    const task = tasks.find(t => t.id === activeTaskId);
    if (task) {
      task.pomodoros++;
      saveTasks();
      updateTaskChart();
    }
  }

  function getLastNDaysStats(n = 7) {
    const stats = JSON.parse(localStorage.getItem("pomodoroStats") || "{}");
    const result = [];
    const labels = [];
    const now = new Date();

    for (let i = n - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(now.getDate() - i);
      const key = date.toISOString().slice(0, 10);
      labels.push(key);
      result.push(stats[key] || 0);
    }

    return { labels, result };
  }

  function updateGlobalChart() {
    const { labels, result } = getLastNDaysStats();
    if (!globalChart) {
      globalChart = new Chart(statsChartCtx, {
        type: "bar",
        data: {
          labels,
          datasets: [{
            label: "Pomodoros completados",
            data: result,
            backgroundColor: "#10b981",
          }]
        },
        options: {
          scales: {
            y: { beginAtZero: true, ticks: { stepSize: 1 } }
          }
        }
      });
    } else {
      globalChart.data.labels = labels;
      globalChart.data.datasets[0].data = result;
      globalChart.update();
    }
  }

  function updateTaskChart() {
    if (tasks.length === 0) {
      if (taskChart) {
        taskChart.destroy();
        taskChart = null;
      }
      return;
    }
    const labels = tasks.map(t => t.name);
    const data = tasks.map(t => t.pomodoros);
    if (!taskChart) {
      taskChart = new Chart(taskStatsChartCtx, {
        type: "bar",
        data: {
          labels,
          datasets: [{
            label: "Pomodoros por tarea",
            data,
            backgroundColor: "#3b82f6",
          }]
        },
        options: {
          indexAxis: 'y',
          scales: {
            x: { beginAtZero: true, ticks: { stepSize: 1 } }
          }
        }
      });
    } else {
      taskChart.data.labels = labels;
      taskChart.data.datasets[0].data = data;
      taskChart.update();
    }
  }

  function updateCharts() {
    updateDailyCount();
    updateGlobalChart();
    updateTaskChart();
  }

  function handlePhaseCompletion() {
    if (currentPhase === "Trabajo") {
      cycles++;
      savePomodoroCompletion();
      savePomodoroForActiveTask();
      setPhase(cycles % 4 === 0 ? "Descanso largo" : "Descanso corto");
    } else {
      setPhase("Trabajo");
    }
    startTimer();
  }

  startBtn.addEventListener("click", startTimer);
  resetBtn.addEventListener("click", resetTimer);
  taskForm.addEventListener("submit", e => {
    e.preventDefault();
    const name = taskInput.value.trim();
    if (name) {
      addTask(name);
      taskInput.value = "";
    }
  });

  
  const toggleBtn = document.getElementById("toggleTheme");
  toggleBtn.addEventListener("click", () => {
    document.documentElement.classList.toggle("dark");
    const isDark = document.documentElement.classList.contains("dark");
    toggleBtn.textContent = isDark ? "☀️" : "🌙";
    localStorage.setItem("theme", isDark ? "dark" : "light");
  });

  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "dark") {
    document.documentElement.classList.add("dark");
    toggleBtn.textContent = "☀️";
  }

  setPhase("Trabajo");
  loadTasks();
  updateCharts();
});
