// --- FIXED PASTE SCHEDULE SCANNER LOGIC ---

window.openPdfScanner = function () {
    if (!window.isAdmin) return showToast("Only admins can scan schedules for now.");
    document.getElementById('pdfScannerModal').classList.remove('hidden');
    resetPdfScanner();
}

window.resetPdfScanner = function () {
    document.getElementById('pdf-upload-zone').classList.remove('hidden');
    document.getElementById('pdf-parsing-loader').classList.add('hidden');
    document.getElementById('pdf-review-zone').classList.add('hidden');
    document.getElementById('pdf-scanner-footer').classList.add('hidden');
    document.getElementById('extracted-classes-list').innerHTML = '';
    const textarea = document.getElementById('pdf-paste-input');
    if (textarea) textarea.value = '';
    const saveBtn = document.getElementById('btn-save-extracted');
    if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerText = "Save All to Schedule";
    }
}

window.handlePasteParse = async function () {
    const text = document.getElementById('pdf-paste-input').value.trim();
    if (!text) return showToast("Please paste some text first.", "error");

    document.getElementById('pdf-upload-zone').classList.add('hidden');
    document.getElementById('pdf-parsing-loader').classList.remove('hidden');

    setTimeout(() => {
        try {
            const extractedClasses = parsePastedText(text);
            displayExtractedClasses(extractedClasses);
        } catch (err) {
            console.error(err);
            showToast("Extraction error: " + err.message, "error");
            resetPdfScanner();
        }
    }, 500);
}

function parsePastedText(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l !== "");
    const classes = [];

    let currentSubject = null;

    const dayMap = {
        'MON': 'Monday', 'TUE': 'Tuesday', 'WED': 'Wednesday', 'THU': 'Thursday',
        'FRI': 'Friday', 'SAT': 'Saturday', 'SUN': 'Sunday'
    };

    lines.forEach(line => {
        // Sched Regex: Matches "MON - 08:00 AM-10:00 AM / 101"
        const schedRegex = /^([A-Z]{3})\s*-\s*(\d{1,2}:\d{2}\s*[APM]{2})-(\d{1,2}:\d{2}\s*[APM]{2})\s*\/\s*(.*)$/i;
        const match = line.match(schedRegex);

        if (match) {
            if (currentSubject) {
                classes.push({
                    day_of_week: dayMap[match[1].toUpperCase()] || match[1],
                    subject_code: currentSubject.code,
                    subject_name: currentSubject.description,
                    start_time: formatTimePaste(match[2]),
                    end_time: formatTimePaste(match[3]),
                    room: match[4].trim(),
                    instructor: currentSubject.instructor || ""
                });
            }
        } else if (!line.toLowerCase().includes("code") && !line.toLowerCase().includes("description")) {
            // Metadata Line: Code [Tab] Description [Tab] Units [Tab] Section [Tab] Instructor
            let parts = line.split('\t');

            // Fallback: If no tabs, try splitting by triple spaces (common in copy-paste)
            if (parts.length < 2) {
                parts = line.split(/\s{3,}/);
            }

            if (parts.length >= 2) {
                currentSubject = {
                    code: parts[0].trim(),
                    description: parts[1].trim(),
                    // Index 4 is instructor based on portals
                    instructor: parts[4] ? parts[4].trim() : ""
                };
            }
        }
    });

    if (classes.length === 0) {
        throw new Error("No classes were extracted. Please ensure the text matches the expected format.");
    }

    return classes;
}

function formatTimePaste(timeStr) {
    // Standardize: Ensure space before AM/PM
    let s = timeStr.trim().toUpperCase();
    if (!s.includes(" ")) {
        s = s.replace(/(AM|PM)/, " $1");
    }

    let [time, modifier] = s.split(" ");
    let [hours, minutes] = time.split(":");
    let h = parseInt(hours, 10);

    if (h === 12) h = modifier === "AM" ? 0 : 12;
    else if (modifier === "PM") h += 12;

    return `${String(h).padStart(2, "0")}:${minutes}`;
}

let pendingClasses = [];

window.displayExtractedClasses = function (classes) {
    pendingClasses = classes;
    document.getElementById('pdf-parsing-loader').classList.add('hidden');
    document.getElementById('pdf-review-zone').classList.remove('hidden');
    document.getElementById('pdf-scanner-footer').classList.remove('hidden');

    const list = document.getElementById('extracted-classes-list');
    list.innerHTML = classes.map((cls, idx) => `
        <div class="class-card" style="padding: 10px; border-left: 4px solid #0984e3; background: #fff; margin-bottom: 10px; border-radius: 5px; box-shadow: 2px 2px 5px rgba(0,0,0,0.05);">
            <div style="display:flex; justify-content: space-between;">
                <strong>${cls.day_of_week}</strong>
                <button onclick="removeExtracted(${idx})" style="color:red; background:none; border:none; cursor:pointer;"><i class="fas fa-trash"></i></button>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 5px;">
                <div>
                    <small style="color: #666;">Code:</small><br>
                    <input type="text" value="${cls.subject_code}" onchange="updateExtracted(${idx}, 'subject_code', this.value)" style="width:100%; font-size: 0.9rem; padding: 4px; border: 1px solid #ddd; border-radius: 3px;">
                </div>
                <div>
                    <small style="color: #666;">Room:</small><br>
                    <input type="text" value="${cls.room}" onchange="updateExtracted(${idx}, 'room', this.value)" style="width:100%; font-size: 0.9rem; padding: 4px; border: 1px solid #ddd; border-radius: 3px;">
                </div>
            </div>
            <div style="margin-top: 5px;">
                <small style="color: #666;">Subject Name:</small><br>
                <input type="text" value="${cls.subject_name}" onchange="updateExtracted(${idx}, 'subject_name', this.value)" style="width:100%; font-size: 0.9rem; padding: 4px; border: 1px solid #ddd; border-radius: 3px;">
            </div>
            <div style="margin-top: 5px;">
                <small style="color: #666;">Instructor:</small><br>
                <input type="text" value="${cls.instructor}" onchange="updateExtracted(${idx}, 'instructor', this.value)" placeholder="Teacher's Name" style="width:100%; font-size: 0.9rem; padding: 4px; border: 1px solid #ddd; border-radius: 3px;">
            </div>
            <div style="display: flex; gap: 15px; margin-top: 5px;">
                <span><small style="color: #666;">Start:</small> <b>${window.formatTime12h(cls.start_time)}</b></span>
                <span><small style="color: #666;">End:</small> <b>${window.formatTime12h(cls.end_time)}</b></span>
            </div>
        </div>
    `).join('');
}

window.removeExtracted = function (idx) {
    pendingClasses.splice(idx, 1);
    displayExtractedClasses(pendingClasses);
}

window.updateExtracted = function (idx, field, value) {
    pendingClasses[idx][field] = value;
}

window.saveExtractedClasses = async function () {
    if (pendingClasses.length === 0) return showToast("No classes to save.", "error");

    const btn = document.getElementById('btn-save-extracted');
    if (btn) {
        btn.disabled = true;
        btn.innerText = "Saving...";
    }

    try {
        const { error } = await window.db.from('schedule').insert(pendingClasses);
        if (error) throw error;

        showToast(`Saved ${pendingClasses.length} entries!`);
        document.getElementById('pdfScannerModal').classList.add('hidden');

        if (window.loadSchedule) loadSchedule('All');
        if (window.populateSubjectOptions) populateSubjectOptions();
    } catch (err) {
        console.error(err);
        showToast("Error: " + err.message, "error");
        if (btn) {
            btn.disabled = false;
            btn.innerText = "Save All to Schedule";
        }
    }
}
