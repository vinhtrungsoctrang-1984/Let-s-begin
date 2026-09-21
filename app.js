const DEFAULT_TASKS = [
    {
        name: "Eat Breakfast",
        duration: 15,
        icon: "🍳"
    },
    {
        name: "Personal Hygiene",
        duration: 10,
        icon: "🚿"
    },
    {
        name: "Get Dressed",
        duration: 10,
        icon: "👕"
    },
    {
        name: "Pack School Bag",
        duration: 10,
        icon: "🎒"
    },
    {
        name: "Put on Shoes & Get Ready",
        duration: 5,
        icon: "👟"
    }
];

// Ma ngay theo Date.getDay(): 0=CN, 1=T2, 2=T3, 3=T4, 4=T5, 5=T6, 6=T7
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DEFAULT_DAYS = [1, 2, 3, 4, 5]; // Mac dinh T2 - T6

const STORAGE_KEY = "morningTimelineData";
const AUTO_RUN_KEY = "morningLastAutoStartDate"; // Luu ngay da tu dong bat dau, tranh lap lai nhieu lan trong 1 ngay

let appData = {
    startTime: "06:00",
    tasks: [],
    days: DEFAULT_DAYS.slice(),
    autoStart: true
};

let timeline = [];
let currentTaskIndex = 0;
let isRunning = false;
let isFinished = false;
let isPending = false; // Dang cho den dung gio thiet lap moi bat dau chay
let timerInterval = null;
let warnedTaskIndex = -1; // Viec da phat am canh bao con 1 phut, tranh phat lap lai
let taskStartTimestamp = null; // Thoi diem (mili giay) viec hien tai bat dau duoc dem nguoc

let audioCtx = null;


/* Khoi tao ung dung */
function initApp() {

    loadData();

    renderSettings();

    buildTimeline();

    renderTimeline();

    // Dang ky bo dem truoc tien, de dam bao dong ho luon tiep tuc chay
    // moi giay du lan goi dau tien co bi loi hay khong
    setInterval(safeUpdateClock, 1000);

    safeUpdateClock();

    setupAudioUnlock();

    document
        .getElementById("btnSettings")
        .addEventListener("click", showSettings);

    document
        .getElementById("btnBack")
        .addEventListener("click", showMain);

    document
        .getElementById("btnAddTask")
        .addEventListener("click", addTask);

    document
        .getElementById("btnSaveSettings")
        .addEventListener("click", saveSettings);

    document
        .getElementById("btnStart")
        .addEventListener("click", startTimeline);

    document
        .getElementById("btnDone")
        .addEventListener("click", completeCurrentTask);

    document
        .getElementById("btnReset")
        .addEventListener("click", resetTimeline);

    showCurrentTask();
}


/* Doc du lieu da luu */
function loadData() {

    const savedData = localStorage.getItem(STORAGE_KEY);

    if (savedData) {

        try {

            const parsedData = JSON.parse(savedData);

            if (
                parsedData &&
                typeof parsedData.startTime === "string" &&
                Array.isArray(parsedData.tasks) &&
                parsedData.tasks.length > 0
            ) {

                appData = parsedData;

                // Bo sung du lieu moi neu ban luu cu chua co (tuong thich nguoc)
                if (
                    !Array.isArray(appData.days) ||
                    appData.days.length === 0
                ) {

                    appData.days = DEFAULT_DAYS.slice();
                }

                if (typeof appData.autoStart !== "boolean") {

                    appData.autoStart = true;
                }

                return;
            }

        } catch (error) {

            console.log("Khong doc duoc du lieu da luu.");
        }
    }

    appData = {
        startTime: "06:00",
        tasks: JSON.parse(JSON.stringify(DEFAULT_TASKS)),
        days: DEFAULT_DAYS.slice(),
        autoStart: true
    };
}


/* Luu du lieu */
function saveData() {

    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(appData)
    );
}


/* Chuyen phut sang chuoi HH:mm */
function minutesToTime(totalMinutes) {

    totalMinutes = Math.round(totalMinutes);

    totalMinutes = totalMinutes % 1440;

    if (totalMinutes < 0) {
        totalMinutes += 1440;
    }

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    return (
        String(hours).padStart(2, "0") +
        ":" +
        String(minutes).padStart(2, "0")
    );
}


/* Chuyen HH:mm sang so phut */
function timeToMinutes(timeString) {

    const parts = timeString.split(":");

    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);

    if (
        Number.isNaN(hours) ||
        Number.isNaN(minutes)
    ) {
        return 0;
    }

    return hours * 60 + minutes;
}


/* Chuoi ngay dang yyyy-mm-dd, dung de danh dau da tu dong bat dau trong ngay */
function getDateString(date) {

    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");

    return `${y}-${m}-${d}`;
}


/* Tao timeline tu dong */
function buildTimeline() {

    timeline = [];

    let currentMinutes = timeToMinutes(
        appData.startTime
    );

    appData.tasks.forEach((task, index) => {

        const startMinutes = currentMinutes;

        const duration = Math.max(
            1,
            parseInt(task.duration, 10) || 1
        );

        const endMinutes =
            startMinutes + duration;

        timeline.push({

            index: index,

            name: task.name,

            duration: duration,

            icon: task.icon,

            startMinutes: startMinutes,

            endMinutes: endMinutes,

            startTime: minutesToTime(startMinutes),

            endTime: minutesToTime(endMinutes)
        });

        currentMinutes = endMinutes;
    });
}


/* Goi updateClock an toan: neu co loi phat sinh ben trong,
   chi bo qua lan cap nhat do, khong lam dung han bo dem 1 giay */
function safeUpdateClock() {

    try {

        updateClock();

    } catch (error) {

        console.log("Loi khi cap nhat dong ho:", error);
    }
}


/* Cap nhat dong ho hien tai */
function updateClock() {

    const now = new Date();

    const hours = String(
        now.getHours()
    ).padStart(2, "0");

    const minutes = String(
        now.getMinutes()
    ).padStart(2, "0");

    const seconds = String(
        now.getSeconds()
    ).padStart(2, "0");

    document.getElementById(
        "currentClock"
    ).textContent =
        `${hours}:${minutes}:${seconds}`;

    const day = String(
        now.getDate()
    ).padStart(2, "0");

    const month = String(
        now.getMonth() + 1
    ).padStart(2, "0");

    const year = now.getFullYear();

    document.getElementById(
        "currentDate"
    ).textContent =
        `${day}/${month}/${year}`;

    if (isRunning) {

        updateCountdown();
    }

    checkAutoStart(now);

    checkPendingStart(now);
}


/* Kiem tra xem da den dung gio thiet lap de bat dau chua,
   ap dung khi nguoi dung bam START nhung chua den gio */
function checkPendingStart(now) {

    try {

        if (!isPending) {
            return;
        }

        const nowMinutes =
            now.getHours() * 60 + now.getMinutes();

        const startMinutes = timeToMinutes(
            appData.startTime
        );

        if (nowMinutes >= startMinutes) {

            beginTimelineNow();
        }

    } catch (error) {

        console.log("Loi khi kiem tra trang thai cho:", error);
    }
}


/* Kiem tra lich va tu dong bat dau timeline khi den gio */
function checkAutoStart(now) {

    try {

        if (!appData.autoStart) {
            return;
        }

        if (isRunning || isFinished || isPending) {
            return;
        }

        if (!Array.isArray(timeline) || timeline.length === 0) {
            return;
        }

        if (!Array.isArray(appData.days)) {
            return;
        }

        const currentDay = now.getDay();

        if (!appData.days.includes(currentDay)) {
            return;
        }

        const nowMinutes =
            now.getHours() * 60 + now.getMinutes();

        const startMinutes = timeToMinutes(
            appData.startTime
        );

        if (nowMinutes < startMinutes) {
            return;
        }

        const todayString = getDateString(now);

        let lastAutoDate = null;

        try {

            lastAutoDate = localStorage.getItem(
                AUTO_RUN_KEY
            );

        } catch (storageError) {

            console.log("Khong doc duoc localStorage:", storageError);
        }

        if (lastAutoDate === todayString) {
            return;
        }

        try {

            localStorage.setItem(
                AUTO_RUN_KEY,
                todayString
            );

        } catch (storageError) {

            console.log("Khong ghi duoc localStorage:", storageError);
        }

        // Tu dong chuyen ve man hinh chinh (man hinh cua be) neu dang o man hinh thiet lap
        showMain();

        startTimeline();

    } catch (error) {

        console.log("Loi khi kiem tra tu dong bat dau:", error);
    }
}


/* Hien thi cong viec hien tai */
function showCurrentTask() {

    if (timeline.length === 0) {
        return;
    }

    if (
        currentTaskIndex < 0 ||
        currentTaskIndex >= timeline.length
    ) {
        currentTaskIndex = 0;
    }

    warnedTaskIndex = -1;
    setWarningState(false);

    const task = timeline[currentTaskIndex];

    document.getElementById(
        "stepNumber"
    ).textContent =
        `Task ${currentTaskIndex + 1} / ${timeline.length}`;

    document.getElementById(
        "currentIcon"
    ).textContent =
        task.icon;

    document.getElementById(
        "currentTaskName"
    ).textContent =
        task.name;

    document.getElementById(
        "taskStartTime"
    ).textContent =
        task.startTime;

    document.getElementById(
        "taskEndTime"
    ).textContent =
        task.endTime;

    renderTimeline();

    updateCountdown();
}


/* Bat/tat trang thai canh bao con 1 phut */
function setWarningState(isWarning) {

    const box = document.querySelector(
        ".current-task-box"
    );

    if (!box) {
        return;
    }

    if (isWarning) {

        box.classList.add("warning");

    } else {

        box.classList.remove("warning");
    }
}


/* Hien khoi noi dung cong viec, an thong bao hoan thanh */
function showTaskContent() {

    document.getElementById(
        "taskContent"
    ).classList.remove("hidden");

    document.getElementById(
        "doneMessage"
    ).classList.add("hidden");
}


/* Hien thong bao da chuan bi xong, an khoi noi dung cong viec */
function showDoneMessage() {

    document.getElementById(
        "taskContent"
    ).classList.add("hidden");

    document.getElementById(
        "doneMessage"
    ).classList.remove("hidden");
}


/* Cap nhat dem nguoc */
function updateCountdown() {

    if (timeline.length === 0) {
        return;
    }

    const task = timeline[currentTaskIndex];

    let remaining =
        task.duration * 60;

    if (isRunning && taskStartTimestamp) {

        const elapsedSeconds = Math.floor(
            (Date.now() - taskStartTimestamp) / 1000
        );

        remaining =
            task.duration * 60 - elapsedSeconds;

        if (remaining < 0) {

            remaining = 0;
        }
    }

    const minutes =
        Math.floor(remaining / 60);

    const seconds =
        remaining % 60;

    document.getElementById(
        "countdown"
    ).textContent =
        `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

    let totalSeconds =
        task.duration * 60;

    let usedSeconds =
        totalSeconds - remaining;

    let progress =
        (usedSeconds / totalSeconds) * 100;

    progress =
        Math.max(0, Math.min(100, progress));

    document.getElementById(
        "progressBar"
    ).style.width =
        `${progress}%`;

    // Canh bao khi con tu 1 phut tro xuong
    if (
        isRunning &&
        remaining > 0 &&
        remaining <= 60
    ) {

        setWarningState(true);

        if (warnedTaskIndex !== currentTaskIndex) {

            warnedTaskIndex = currentTaskIndex;

            playWarningSound();
        }

    } else {

        setWarningState(false);
    }

    if (isRunning && remaining === 0) {

        autoFinishTask();
    }
}


/* Bam nut START: neu chua den gio thiet lap thi cho, den dung gio moi chay */
function startTimeline() {

    if (timeline.length === 0) {
        return;
    }

    const now = new Date();

    const nowMinutes =
        now.getHours() * 60 + now.getMinutes();

    const startMinutes = timeToMinutes(
        appData.startTime
    );

    if (nowMinutes < startMinutes) {

        armPendingStart();

        return;
    }

    beginTimelineNow();
}


/* Chuyen sang trang thai cho den dung gio thiet lap */
function armPendingStart() {

    isPending = true;
    isRunning = false;
    isFinished = false;

    if (timerInterval) {

        clearInterval(timerInterval);

        timerInterval = null;
    }

    document.getElementById(
        "btnStart"
    ).textContent =
        `⏳ WAITING FOR ${appData.startTime}`;

    speak(`Okay! I will start at ${formatTimeForSpeech(appData.startTime)}.`);
}


/* Bat dau thuc su chay timeline ngay tai thoi diem nay */
function beginTimelineNow() {

    isPending = false;
    isRunning = true;
    isFinished = false;

    currentTaskIndex = 0;
    warnedTaskIndex = -1;
    taskStartTimestamp = Date.now();

    setWarningState(false);
    showTaskContent();

    showCurrentTask();

    if (timerInterval) {

        clearInterval(timerInterval);
    }

    timerInterval = setInterval(
        updateCountdown,
        1000
    );

    document.getElementById(
        "btnStart"
    ).textContent =
        "▶ RUNNING";

    // Doc bang giong noi: bat dau viec dau tien
    speak(`Let's begin! Time to ${timeline[currentTaskIndex].name}.`);
}


/* Doi gio dang "HH:mm" sang dang de doc bang giong noi, vi du "6:00 AM" */
function formatTimeForSpeech(timeString) {

    const parts = timeString.split(":");

    let hours = parseInt(parts[0], 10);
    const minutes = parts[1];

    const period = hours >= 12 ? "PM" : "AM";

    let hours12 = hours % 12;

    if (hours12 === 0) {

        hours12 = 12;
    }

    return `${hours12}:${minutes} ${period}`;
}


/* Hoan thanh cong viec (nguoi dung bam XONG) */
function completeCurrentTask() {

    if (!isRunning) {

        isRunning = true;
    }

    if (
        currentTaskIndex >=
        timeline.length - 1
    ) {

        finishTimeline(null);

        return;
    }

    currentTaskIndex++;
    taskStartTimestamp = Date.now();

    showCurrentTask();

    // Doc bang giong noi: chuyen sang viec ke tiep
    speak(`Great job! Time to ${timeline[currentTaskIndex].name}.`);
}


/* Tu dong chuyen viec khi het gio */
function autoFinishTask() {

    const finishedTaskName =
        timeline[currentTaskIndex].name;

    if (
        currentTaskIndex >=
        timeline.length - 1
    ) {

        finishTimeline(finishedTaskName);

        return;
    }

    currentTaskIndex++;
    taskStartTimestamp = Date.now();

    showCurrentTask();

    // Doc bang giong noi: bao het gio viec cu, bat dau viec moi
    speak(`Time's up for ${finishedTaskName}. Next, ${timeline[currentTaskIndex].name}.`);
}


/* Ket thuc toan bo timeline */
function finishTimeline(lastTaskName) {

    isRunning = false;
    isFinished = true;

    if (timerInterval) {

        clearInterval(timerInterval);

        timerInterval = null;
    }

    currentTaskIndex =
        timeline.length - 1;

    showDoneMessage();

    document.getElementById(
        "btnStart"
    ).textContent =
        "✓ ALL DONE";

    renderTimeline();

    // Doc bang giong noi: bao hoan thanh toan bo lich trinh
    let message = "All done! Great job! You're ready for school!";

    if (lastTaskName) {

        message = `Time's up for ${lastTaskName}. ` + message;
    }

    speak(message);
}


/* Reset timeline */
function resetTimeline() {

    isRunning = false;
    isFinished = false;
    isPending = false;

    if (timerInterval) {

        clearInterval(timerInterval);

        timerInterval = null;
    }

    currentTaskIndex = 0;
    warnedTaskIndex = -1;
    taskStartTimestamp = null;

    setWarningState(false);
    showTaskContent();

    document.getElementById(
        "btnStart"
    ).textContent =
        "▶ START";

    showCurrentTask();
}


/* Ve timeline */
function renderTimeline() {

    const container =
        document.getElementById(
            "timelineList"
        );

    container.innerHTML = "";

    timeline.forEach((task, index) => {

        const item =
            document.createElement("div");

        item.className =
            "timeline-item";

        if (index === currentTaskIndex) {

            item.classList.add("active");
        }

        if (
            index < currentTaskIndex &&
            isRunning
        ) {

            item.classList.add("completed");
        }

        item.innerHTML = `
            <div class="timeline-time">
                ${task.startTime}<br>
                ${task.endTime}
            </div>

            <div class="timeline-icon">
                ${task.icon}
            </div>

            <div>
                <div class="timeline-name">
                    ${escapeHtml(task.name)}
                </div>

                <div class="timeline-duration">
                    ${task.duration} min
                </div>
            </div>
        `;

        container.appendChild(item);
    });
}


/* Ve danh sach cong viec trong phan thiet lap */
function renderSettings() {

    document.getElementById(
        "startTime"
    ).value =
        appData.startTime;

    document.getElementById(
        "autoStartToggle"
    ).checked =
        appData.autoStart;

    renderDaysCheckboxes();

    const container =
        document.getElementById(
            "settingsTaskList"
        );

    container.innerHTML = "";

    appData.tasks.forEach(
        (task, index) => {

            const row =
                document.createElement("div");

            row.className =
                "setting-task";

            row.innerHTML = `
                <div class="task-number">
                    ${index + 1}
                </div>

                <input
                    type="text"
                    class="task-name-input"
                    data-index="${index}"
                    value="${escapeAttribute(task.name)}"
                    placeholder="Task name"
                >

                <input
                    type="number"
                    min="1"
                    max="180"
                    class="task-duration-input"
                    data-index="${index}"
                    value="${task.duration}"
                >

                <button
                    class="delete-task-button"
                    data-index="${index}"
                    title="Delete task"
                >
                    🗑
                </button>
            `;

            container.appendChild(row);
        }
    );

    const nameInputs =
        container.querySelectorAll(
            ".task-name-input"
        );

    nameInputs.forEach(input => {

        input.addEventListener(
            "input",
            function () {

                const index =
                    parseInt(
                        this.dataset.index,
                        10
                    );

                appData.tasks[index].name =
                    this.value;
            }
        );
    });

    const durationInputs =
        container.querySelectorAll(
            ".task-duration-input"
        );

    durationInputs.forEach(input => {

        input.addEventListener(
            "input",
            function () {

                const index =
                    parseInt(
                        this.dataset.index,
                        10
                    );

                let duration =
                    parseInt(
                        this.value,
                        10
                    );

                if (
                    Number.isNaN(duration) ||
                    duration < 1
                ) {

                    duration = 1;
                }

                if (duration > 180) {

                    duration = 180;
                }

                appData.tasks[index].duration =
                    duration;
            }
        );
    });

    const deleteButtons =
        container.querySelectorAll(
            ".delete-task-button"
        );

    deleteButtons.forEach(button => {

        button.addEventListener(
            "click",
            function () {

                const index =
                    parseInt(
                        this.dataset.index,
                        10
                    );

                deleteTask(index);
            }
        );
    });
}


/* Ve cac o checkbox chon ngay ap dung */
function renderDaysCheckboxes() {

    const container = document.getElementById(
        "daysCheckboxList"
    );

    container.innerHTML = "";

    // Sap xep hien thi T2 -> T7 -> CN cho de nhin, du gia tri van la getDay() goc
    const displayOrder = [1, 2, 3, 4, 5, 6, 0];

    displayOrder.forEach(dayIndex => {

        const wrapper =
            document.createElement("label");

        wrapper.className = "day-checkbox";

        const checked =
            appData.days.includes(dayIndex)
                ? "checked"
                : "";

        wrapper.innerHTML = `
            <input
                type="checkbox"
                class="day-checkbox-input"
                data-day="${dayIndex}"
                ${checked}
            >
            <span>${DAY_LABELS[dayIndex]}</span>
        `;

        container.appendChild(wrapper);
    });
}


/* Them cong viec */
function addTask() {

    appData.tasks.push({

        name: "New Task",

        duration: 5,

        icon: "⭐"
    });

    renderSettings();
}


/* Xoa cong viec */
function deleteTask(index) {

    if (appData.tasks.length <= 1) {

        alert("Cannot delete the last task.");

        return;
    }

    appData.tasks.splice(index, 1);

    renderSettings();
}


/* Luu thiet lap */
function saveSettings() {

    const startTime =
        document.getElementById(
            "startTime"
        ).value;

    if (!startTime) {

        alert("Please select a start time.");

        return;
    }

    const dayInputs =
        document.querySelectorAll(
            ".day-checkbox-input"
        );

    const selectedDays = [];

    dayInputs.forEach(input => {

        if (input.checked) {

            selectedDays.push(
                parseInt(input.dataset.day, 10)
            );
        }
    });

    if (selectedDays.length === 0) {

        alert("Please select at least one day.");

        return;
    }

    appData.startTime =
        startTime;

    appData.days = selectedDays;

    appData.autoStart =
        document.getElementById(
            "autoStartToggle"
        ).checked;

    const nameInputs =
        document.querySelectorAll(
            ".task-name-input"
        );

    nameInputs.forEach(input => {

        const index =
            parseInt(
                input.dataset.index,
                10
            );

        appData.tasks[index].name =
            input.value.trim() ||
            "New Task";
    });

    const durationInputs =
        document.querySelectorAll(
            ".task-duration-input"
        );

    durationInputs.forEach(input => {

        const index =
            parseInt(
                input.dataset.index,
                10
            );

        let duration =
            parseInt(
                input.value,
                10
            );

        if (
            Number.isNaN(duration) ||
            duration < 1
        ) {

            duration = 1;
        }

        if (duration > 180) {

            duration = 180;
        }

        appData.tasks[index].duration =
            duration;
    });

    saveData();

    buildTimeline();

    currentTaskIndex = 0;

    isRunning = false;
    isFinished = false;
    isPending = false;

    if (timerInterval) {

        clearInterval(timerInterval);

        timerInterval = null;
    }

    document.getElementById(
        "btnStart"
    ).textContent =
        "▶ START";

    showTaskContent();

    renderTimeline();

    showCurrentTask();

    showMain();
}


/* Mo man hinh thiet lap */
function showSettings() {

    renderSettings();

    document.getElementById(
        "screenMain"
    ).classList.add("hidden");

    document.getElementById(
        "screenSettings"
    ).classList.remove("hidden");
}


/* Mo man hinh chinh */
function showMain() {

    document.getElementById(
        "screenSettings"
    ).classList.add("hidden");

    document.getElementById(
        "screenMain"
    ).classList.remove("hidden");
}


/* ================= AM THANH CANH BAO ================= */
/* Dung Web Audio API de phat tieng "beep" don gian, khong can file am thanh rieng */

/* Lay hoac tao AudioContext */
function getAudioContext() {

    if (!audioCtx) {

        const AudioContextClass =
            window.AudioContext ||
            window.webkitAudioContext;

        if (AudioContextClass) {

            audioCtx = new AudioContextClass();
        }
    }

    return audioCtx;
}


/* Phat 1 tieng beep voi tan so va thoi luong tuy chinh */
function playBeep(frequency, durationMs, volume) {

    const ctx = getAudioContext();

    if (!ctx) {
        return;
    }

    if (ctx.state === "suspended") {

        ctx.resume();
    }

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gainNode.gain.value = volume;

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start();

    oscillator.stop(
        ctx.currentTime + durationMs / 1000
    );
}


/* Am bao khi cong viec con 1 phut */
function playWarningSound() {

    playBeep(880, 200, 0.2);
}


/* Doc 1 cau bang giong noi tieng Anh, thay cho tieng "tit tit" khi
   bat dau/ket thuc mot viec */
function speak(text) {

    try {

        if (!("speechSynthesis" in window)) {
            return;
        }

        // Dung cau dang doc do (neu co) de tranh chong tieng
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);

        utterance.lang = "en-US";
        utterance.rate = 0.95;
        utterance.pitch = 1.05;
        utterance.volume = 1;

        window.speechSynthesis.speak(utterance);

    } catch (error) {

        console.log("Loi phat giong noi:", error);
    }
}


/* Mo khoa am thanh + giong noi: trinh duyet chi cho phat am thanh
   tu dong sau khi nguoi dung da cham/click it nhat 1 lan tren trang */
function setupAudioUnlock() {

    const banner = document.getElementById(
        "audioUnlockBanner"
    );

    const ctx = getAudioContext();

    const needUnlock =
        (ctx && ctx.state === "suspended") ||
        ("speechSynthesis" in window);

    if (!needUnlock) {

        if (banner) {
            banner.classList.add("hidden");
        }

        return;
    }

    if (banner) {
        banner.classList.remove("hidden");
    }

    const unlock = function () {

        const context = getAudioContext();

        if (context && context.state === "suspended") {

            context.resume();
        }

        // "Lam nong" bo may doc giong noi bang 1 cau rong
        try {

            if ("speechSynthesis" in window) {

                const primer = new SpeechSynthesisUtterance("");

                window.speechSynthesis.speak(primer);
            }

        } catch (error) {

            console.log("Khong the khoi dong bo doc giong noi:", error);
        }

        if (banner) {
            banner.classList.add("hidden");
        }

        document.removeEventListener("click", unlock);
        document.removeEventListener("touchstart", unlock);
    };

    document.addEventListener("click", unlock);
    document.addEventListener("touchstart", unlock);

    if (banner) {

        banner.addEventListener("click", unlock);
    }
}


/* Bao ve HTML */
function escapeHtml(value) {

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/* Bao ve gia tri HTML attribute */
function escapeAttribute(value) {

    return escapeHtml(value);
}


/* Khoi dong */
document.addEventListener(
    "DOMContentLoaded",
    initApp
);
