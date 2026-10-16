// Midterms popup: front page + per-subject detail. Reuses wimpy-modal + viewFullImage.
const MIDTERMS = [
    {
        id: 'ged107',
        code: 'GED 107',
        name: 'Ethics',
        date: 'Oct 21',
        time: '2:00 - 3:30 PM',
        section: 'IT 3101 - 3112',
        img: 'assets/images/SCHEDULE_MIDTERMS/ETHICS POINTER.jpg',
        format: 'Application, case study analysis',
        items: '3 cases',
        points: ['Exam type: Application, case study analysis (3 cases)'],
    },
    {
        id: 'it314',
        code: 'IT 314',
        name: 'Web Systems and Technologies',
        date: 'Oct 22',
        time: '2:00 - 3:30 PM',
        section: 'IT 3101 - 3112',
        img: 'assets/images/SCHEDULE_MIDTERMS/WST POINTERS.jpg',
        format: 'Code writing, problem-solving, code completion, practical application (100 pts)',
        items: 'Part I: 30 · Part II: 30 · Part III: 40',
        points: [
            'JS and DOM',
            'Coverage: arrays, loops, conditional statements, functions, parameters and arguments, `prompt()`, nested if-else statements, and DOM manipulation',
            'Part I, Understanding and Analysis: 30 points',
            'Part II, Application: 30 points',
            'Part III, Application and Practical Skills: 40 points',
        ],
    },
    {
        id: 'bat401',
        code: 'BAT 401',
        name: 'Fundamentals of Business Analytics',
        date: 'Oct 24',
        time: '7:00 - 8:30 AM',
        section: 'IT 3101 - 3107',
        img: 'assets/images/SCHEDULE_MIDTERMS/BAT 401 POINTERS.jpg',
        format: '50 points: writing Python code, enumeration, analysis',
        items: '3 question types',
        points: [
            'Basic data cleaning in Google Colab: load data and import necessary libraries',
            'Identify and display all duplicate rows in the DataFrame `df`, including their first occurrences',
            'View stats table',
            'View first 5 rows',
            'View missing values and replace missing values with mean and mode',
            'Introduction to Tableau: Tableau workflow steps',
            'Tableau Public canvas interface tabs: Columns, Rows, Filters, Marks, and Dashboard, Sheet, Story features',
            'Creating sets and groups in Tableau',
        ],
    },
    {
        id: 'bat402',
        code: 'BAT 402',
        name: 'Fundamentals of Analytics Modeling',
        date: 'Oct 24',
        time: '8:30 - 10:00 AM',
        section: 'IT 3101 - 3107',
        img: 'assets/images/SCHEDULE_MIDTERMS/BAT 402 POINTERS.jpg',
        format: '50 points: Part 1 fill-in-the-blank code (30) + Part 2 computation (20)',
        items: 'Module 3 only',
        points: [
            'Week 10 midterms, Module 3 only',
            'Part 1 (30 points): regression, classification, time series — given a scenario and code, fill in the blanks (clues are in the comments)',
            'Example: `store_data <- read.csv("abc.csv")` (load the dataset into a data frame named store_data)',
            'Example: `library(rpart)` (load the library needed to build the decision tree)',
            'Example: `library(rpart.plot)` (load the library needed to draw the decision tree diagram)',
            'Part 2 computation: not confusion matrix — solve the equation; 4 items, 5 points each (1 pt formula, 2 pts substitution, 1 pt final output, 1 pt recommended action)',
            'Example: given day is Tuesday, finding daily revenue, recommended action is to schedule extra staff',
        ],
    },
    {
        id: 'it311',
        code: 'IT 311',
        name: 'System Administration and Maintenance',
        date: 'Oct 26',
        time: '2:00 - 3:30 PM',
        section: 'IT 3101 - 3106',
        img: 'assets/images/SCHEDULE_MIDTERMS/SAM POINTERS.jpg',
        format: '50 points: screenshot-based analysis and application',
        items: 'Class materials only',
        points: [
            'VirtualBox configuration of RAM, storage, NAT, and operating system requirements',
            'Navigating Device Manager',
            'Device Properties tabs',
            'Adding printers and scanners',
            'Creating MMC and adding snap-ins',
            'Creating volumes',
            'Types of volumes',
            'Driver signing',
            'Recall the steps in doing all tasks done in Devices and Storage configuration',
            'Disk Management configuration task',
            'Device Manager configuration task',
            'Only use our materials to review',
        ],
    },
    {
        id: 'it312',
        code: 'IT 312',
        name: 'System Integration and Architecture',
        date: 'Oct 27',
        time: '11:00 AM - 12:30 PM',
        section: 'IT 3101 - 3112',
        img: 'assets/images/SCHEDULE_MIDTERMS/SIA POINTERS.jpg',
        format: '50 points: identification, case analysis, essay, application (use case document/diagram)',
        items: '4 question types',
        points: [
            'SDLC phases: Design, Implementation, Integration, Testing, and Verification and Validation',
            'System design: definition, importance, activities, and elements of a system',
            'System design requirements and technical design specifications',
            'Software architecture vs. software design',
            'Factors affecting technology trade-offs during system design',
            'Technical reviews: Initial Requirements (IR), Incremental Design Review (IDR), Final Design Meeting (FDM), and Test Readiness (TR)',
            'Technical reviews and audits: First-Article Inspection (FAI), Functional Configuration Audit (FCA), and Physical Configuration Audit (PCA)',
            'Software requirements: definition, analysis, development, and documentation',
            'Types of software requirements: Functional, Non-functional, and Domain',
            'Software requirements development: Analysis, Use Case, Functions, Architecture, Integration, and Verification and Validation',
            'Requirements Traceability Matrix (RTM) and its purpose',
            'Use case diagrams: identifying actors, use cases, system boundaries, and associations',
            'Review the steps in analyzing software requirements and preparing a use case diagram',
        ],
    },
    {
        id: 'it313',
        code: 'IT 313',
        name: 'System Analysis and Design',
        date: 'Oct 27',
        time: '12:30 - 2:30 PM',
        section: 'IT 3101 - 3112',
        img: 'assets/images/SCHEDULE_MIDTERMS/SAD POINTERS.jpg',
        format: 'Format not specified',
        items: 'Mostly diagrams, modules 5-10',
        points: ['More on diagrams, modules 5-10.'],
    },
];

function getMidtermChecks() {
    try {
        return JSON.parse(localStorage.getItem('midterms_checked_v1') || '[]');
    } catch {
        return [];
    }
}

window.midtermOpenImg = function (src) {
    if (window.viewFullImage) window.viewFullImage(src);
    else window.open(src, '_blank');
}

function mtStyle(id) {
    // Same palette/icons as Files tab folders — no new CSS.
    const map = {
        ged107: ['#00b894', 'fa-heart'],
        it314: ['#00cec9', 'fa-laptop-code'],
        bat401: ['#d63031', 'fa-chart-line'],
        bat402: ['#0984e3', 'fa-chart-bar'],
        it311: ['#e17055', 'fa-server'],
        it312: ['#6c5ce7', 'fa-network-wired'],
        it313: ['#fdcb6e', 'fa-diagram-project'],
    };
    return map[id] || ['#636e72', 'fa-folder'];
}

function mtRefreshMenu() {
    const checks = getMidtermChecks();
    document.querySelectorAll('#mt-menu [data-mt]').forEach((b) => {
        b.classList.toggle('active', checks.includes(b.dataset.mt));
    });
}

window.toggleMidtermCheck = function (id, el) {
    let c = getMidtermChecks();
    if (el.checked) c.push(id);
    else c = c.filter((x) => x !== id);
    localStorage.setItem('midterms_checked_v1', JSON.stringify([...new Set(c)]));
    mtRefreshMenu();
};

window.midtermView = function (mode, btn) {
    const detail = document.getElementById('mt-detail');
    if (!detail) return;
    detail.querySelector('.mt-photo').style.display = mode === 'photo' ? 'block' : 'none';
    detail.querySelector('.mt-text').style.display = mode === 'text' ? 'block' : 'none';
    detail.querySelector('.mt-rev').style.display = mode === 'rev' ? 'block' : 'none';
    detail.querySelectorAll('[data-mtview]').forEach((b) => {
        b.classList.toggle('active', b.dataset.mtview === mode);
    });
};

// Reviewer = files already in DB under this subject > Midterms term. Admin sets it by uploading in the Files tab.
window.openMidtermReviewer = async function (code, btn) {
    window.midtermView('rev', btn);
    const box = document.querySelector('#mt-detail .mt-rev');
    if (!box) return;
    box.innerHTML = '<p style="font-family:\'Patrick Hand\';color:#636e72;">Hunting reviewers...</p>';
    const norm = (s) => String(s || '').replace(/\s+/g, '').toUpperCase();
    try {
        if (!window.db) throw new Error('DB not ready');
        let rows = [];
        const exact = await window.db
            .from('shared_files')
            .select('id,title,file_url,file_type,subject,term')
            .eq('subject', code)
            .eq('term', 'Midterms')
            .order('created_at', { ascending: false })
            .limit(20);
        if (!exact.error && exact.data && exact.data.length) {
            rows = exact.data;
        } else {
            // Fallback: code format may differ (IT314 vs IT 314) — match loosely.
            const all = await window.db
                .from('shared_files')
                .select('id,title,file_url,file_type,subject,term')
                .eq('term', 'Midterms')
                .order('created_at', { ascending: false })
                .limit(100);
            if (all.error) throw all.error;
            rows = (all.data || []).filter((f) => norm(f.subject) === norm(code));
        }
        if (!rows.length) {
            box.innerHTML = `<p style="font-family:'Patrick Hand';color:#636e72;">No reviewer uploaded yet for <b>${code}</b>.<br>Admin: upload one in Files tab under ${code} &gt; Midterms.</p>`;
            return;
        }
        const esc = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        box.innerHTML = rows
            .map((f) => {
                const t = (f.file_type || '').toLowerCase();
                const ic = t.includes('pdf') ? 'fa-file-pdf' : t.includes('image') ? 'fa-file-image' : 'fa-file';
                return `<button onclick="openFilePreview('${esc(f.file_url)}','${esc(f.title)}','${f.id}')" class="sketch-btn" style="width:100%;justify-content:flex-start;font-size:1rem;margin-bottom:6px;"><i class="fas ${ic}"></i> ${f.title || 'Untitled'}</button>`;
            })
            .join('');
    } catch (err) {
        console.warn('Reviewer lookup failed:', err);
        box.innerHTML = '<p style="font-family:\'Patrick Hand\';color:#d63031;">Could not load reviewers. Check connection and retry.</p>';
    }
};

window.showMidtermDetail = function (id) {
    const m = MIDTERMS.find((x) => x.id === id);
    if (!m) return;
    const menu = document.getElementById('mt-menu');
    const detail = document.getElementById('mt-detail');
    if (!menu || !detail) return;
    const done = getMidtermChecks().includes(m.id);
    detail.innerHTML = `
        <button onclick="document.getElementById('mt-menu').style.display='block';document.getElementById('mt-detail').style.display='none';" class="sketch-btn" style="font-size:0.9rem;padding:4px 12px;margin-bottom:8px;">← Subjects</button>
        <h3 style="font-family:'Permanent Marker';margin:5px 0;">${m.code} — ${m.name}</h3>
        <p style="font-family:'Patrick Hand';margin:0 0 8px 0;"><b>${m.date} · ${m.time}</b><br><small style="color:#636e72;">${m.section} · ${m.format} · ${m.items}</small></p>
        <label style="display:flex;gap:6px;align-items:center;font-family:'Patrick Hand';margin-bottom:8px;cursor:pointer;">
            <input type="checkbox" ${done ? 'checked' : ''} onchange="toggleMidtermCheck('${m.id}',this)" style="width:18px;height:18px;" /> Reviewed
        </label>
        <div class="subject-folder-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:8px;">
            <div data-mtview="photo" class="subject-folder active" role="button" tabindex="0" onclick="midtermView('photo',this)" onkeydown="if(event.key==='Enter')midtermView('photo',this)" style="--folder-color:#00b894;">
                <div style="position:absolute;top:0;left:0;right:0;height:6px;background:#00b894;border-radius:9px 9px 0 0;"></div>
                <span class="folder-emoji" style="color:#00b894;"><i class="fas fa-image"></i></span>
                <span class="folder-name">Photo</span>
            </div>
            <div data-mtview="text" class="subject-folder" role="button" tabindex="0" onclick="midtermView('text',this)" onkeydown="if(event.key==='Enter')midtermView('text',this)" style="--folder-color:#0984e3;">
                <div style="position:absolute;top:0;left:0;right:0;height:6px;background:#0984e3;border-radius:9px 9px 0 0;"></div>
                <span class="folder-emoji" style="color:#0984e3;"><i class="fas fa-list-ul"></i></span>
                <span class="folder-name">Text list</span>
            </div>
            <div data-mtview="rev" class="subject-folder" role="button" tabindex="0" onclick="openMidtermReviewer('${m.code}',this)" onkeydown="if(event.key==='Enter')openMidtermReviewer('${m.code}',this)" style="--folder-color:#6c5ce7;">
                <div style="position:absolute;top:0;left:0;right:0;height:6px;background:#6c5ce7;border-radius:9px 9px 0 0;"></div>
                <span class="folder-emoji" style="color:#6c5ce7;"><i class="fas fa-book-open"></i></span>
                <span class="folder-name">Reviewer</span>
            </div>
        </div>
        <div class="mt-photo"><img src="${m.img}" alt="${m.code} pointers" loading="lazy" onclick="midtermOpenImg('${m.img}')" style="width:100%;border:2px solid #000;box-shadow:3px 3px 0 #000;cursor:zoom-in;background:#fff;" onerror="this.outerHTML='<p style=color:#d63031;>Photo missing</p>'" /></div>
        <div class="mt-text" style="display:none;background:#fffde7;border:2px dashed #f1c40f;border-radius:8px;padding:10px;font-family:'Patrick Hand';text-align:left;"><b>${m.format}</b><br><small>${m.items}</small><ul style="padding-left:20px;margin:8px 0;">${m.points.map((p) => '<li>' + String(p).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</li>').join('')}</ul></div>
        <div class="mt-rev" style="display:none;"></div>`;
    menu.style.display = 'none';
    detail.style.display = 'block';
};

window.showMidtermsPopup = function () {
    if (document.getElementById('midterms-popup')) return;
    const overlay = document.createElement('div');
    overlay.className = 'wimpy-modal-overlay';
    overlay.id = 'midterms-popup';
    overlay.style.alignItems = 'flex-start';
    overlay.style.overflowY = 'auto';
    overlay.style.padding = '20px';
    overlay.style.backdropFilter = 'none'; // no blur: hover was repainting the blurred backdrop = lag

    const btns = MIDTERMS.map((m) => {
        const [color, icon] = mtStyle(m.id);
        return `
        <div data-mt="${m.id}" class="subject-folder" role="button" tabindex="0" title="${m.code} — ${m.name}" onclick="showMidtermDetail('${m.id}')" onkeydown="if(event.key==='Enter')showMidtermDetail('${m.id}')" style="--folder-color:${color};">
            <div style="position:absolute;top:0;left:0;right:0;height:6px;background:${color};border-radius:9px 9px 0 0;"></div>
            <span class="folder-emoji" style="color:${color};"><i class="fas ${icon}"></i></span>
            <span class="folder-name" title="${m.code} — ${m.name}">${m.code}</span>
            <span title="${m.code} — ${m.name}" style="display:block;font-family:'Patrick Hand';font-size:0.8rem;color:#636e72;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${m.name}</span>
            <span class="folder-count">${m.date}</span>
        </div>`;
    }).join('');

    overlay.innerHTML = `
        <style>#midterms-popup .subject-folder{transition:none;}#midterms-popup .subject-folder:hover{transform:none !important;box-shadow:3px 3px 0 rgba(0,0,0,0.1) !important;}</style>
        <div class="wimpy-modal-box" style="max-width:560px;width:100%;margin:20px auto;background:#fdfbf7;">
            <div id="mt-menu" style="display:block;">
                <div style="background:yellow;display:inline-block;transform:rotate(-1.5deg);padding:2px 10px;border:1px solid #000;font-family:'Permanent Marker';">MIDTERMS NA!</div>
                <h2 style="font-family:'Permanent Marker';margin:10px 0;">LETSS GO TEAMM MIDTERMS NA ARAY Q PO</h2>
                <img src="assets/images/SCHEDULE_MIDTERMS/MIDTERM FRONT.jpg" alt="Midterms" style="width:100%;border:3px solid #000;box-shadow:4px 4px 0 #000;margin-bottom:10px;" onerror="this.remove()" />
                <p style="font-family:'Patrick Hand';">Pick a subject to see its pointers:</p>
                <div class="subject-folder-grid" style="margin-bottom:10px;">${btns}</div>
                <label style="display:flex;gap:6px;align-items:center;justify-content:center;font-family:'Patrick Hand';margin:10px 0;">
                    <input type="checkbox" id="mt-hide" style="width:auto;" /> Don't show again
                </label>
                <button onclick="(function(){if(document.getElementById('mt-hide').checked)localStorage.setItem('midterms_dismissed_v1','1');document.getElementById('midterms-popup').remove();})()" class="sketch-btn" style="background:#000;color:#fff;width:100%;">LETS GO 🔥</button>
            </div>
            <div id="mt-detail" style="display:none;text-align:left;"></div>
        </div>`;
    overlay.onclick = (e) => {
        if (e.target === overlay) overlay.remove();
    };
    document.body.appendChild(overlay);
    mtRefreshMenu();
};

// Auto-show once per device unless dismissed or past midterms week.
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (localStorage.getItem('midterms_dismissed_v1') === '1') return;
        if (new Date() > new Date('2026-10-28T00:00:00')) return;
        window.showMidtermsPopup();
    }, 1200);
});
