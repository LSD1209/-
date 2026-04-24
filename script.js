let currentTab = 'leave-tab';
const LAW_CHANGE_DATE = new Date('2017-05-30');
let currentCalculationData = null;

function parseNumber(value) {
    if (!value) return 0;
    return Number(String(value).replace(/,/g, '')) || 0;
}

function applyCommaFormat(input) {
    const currentValue = input.value;
    const cursorPosition = input.selectionStart;
    const numbersOnly = currentValue.replace(/[^0-9]/g, '');
    if (numbersOnly === '') { input.value = ''; return; }
    const formatted = Number(numbersOnly).toLocaleString('ko-KR');
    const prevCommaCount = (currentValue.match(/,/g) || []).length;
    const newCommaCount = (formatted.match(/,/g) || []).length;
    input.value = formatted;
    const newCursor = Math.min(cursorPosition + (newCommaCount - prevCommaCount), formatted.length);
    input.setSelectionRange(newCursor, newCursor);
}

function attachMoneyFormat(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    input.setAttribute('type', 'text');
    input.setAttribute('inputmode', 'numeric');
    input.addEventListener('input', function() { applyCommaFormat(this); });
    input.addEventListener('paste', function() { setTimeout(() => applyCommaFormat(this), 0); });
}

function openTab(t) {
    currentTab = t;
    const safeDisplay = (id, display) => {
        const element = document.getElementById(id);
        if (element) element.style.display = display;
    };
    safeDisplay('date-inputs', t === 'leave-tab' ? 'block' : 'none');
    safeDisplay('money-inputs', t === 'money-tab' ? 'block' : 'none');
    safeDisplay('history-inputs', t === 'history-tab' ? 'block' : 'none');
    safeDisplay('main-calc-btn', t === 'history-tab' ? 'none' : 'block');
    document.querySelectorAll('.tab-btn').forEach((b, i) => {
        b.classList.toggle('active',
            (i === 0 && t === 'leave-tab') ||
            (i === 1 && t === 'money-tab') ||
            (i === 2 && t === 'history-tab')
        );
    });
    if (t === 'history-tab') {
        renderHistoryList();
    }
}

function mainCalculate() {
    const welcomeMsg = document.getElementById('welcome-msg');
    if (welcomeMsg) welcomeMsg.style.display = 'none';
    const saveBar = document.getElementById('save-action-bar');
    if (saveBar) saveBar.style.display = 'block';
    if (currentTab === 'leave-tab') {
        const leaveReport = document.getElementById('leave-report');
        const moneyReport = document.getElementById('money-report');
        if (leaveReport) leaveReport.style.display = 'block';
        if (moneyReport) moneyReport.style.display = 'none';
        calculateLeave();
    } else if (currentTab === 'money-tab') {
        const leaveReport = document.getElementById('leave-report');
        const moneyReport = document.getElementById('money-report');
        if (leaveReport) leaveReport.style.display = 'none';
        if (moneyReport) moneyReport.style.display = 'block';
        calculateMoney();
    }
    setTimeout(() => collectCurrentCalculationData(), 100);
}

function addRow(t, c1, c2, c3) {
    t.insertAdjacentHTML('beforeend', `<tr><td>${c1}</td><td>${c2}</td><td>${c3}</td></tr>`);
}

function limitDateYearInput(input) {
    const value = input.value;
    if (!value) return;
    const parts = value.split('-');
    if (parts[0] && parts[0].length > 4) { parts[0] = parts[0].slice(0, 4); input.value = parts.join('-'); }
    const yearNum = parseInt(parts[0], 10);
    if (!isNaN(yearNum) && yearNum > 2100) { parts[0] = '2100'; input.value = parts.join('-'); }
}

function togglePromotion() {
    const enablePromotion = document.getElementById('enable-promotion');
    const notice = document.getElementById('promotion-notice');
    if (enablePromotion && notice) {
        notice.style.display = enablePromotion.checked ? 'block' : 'none';
    }
    const leaveReport = document.getElementById('leave-report');
    if (leaveReport && leaveReport.style.display !== 'none') {
        calculateLeave();
    }
}

function calculateLeave() {
    const joinInput = document.getElementById('join-date').value;
    const exitInput = document.getElementById('exit-date').value;
    if (!joinInput || !exitInput) { alert("입사일과 퇴사일을 모두 입력해주세요!"); return; }
    const join = new Date(joinInput);
    const exit = new Date(exitInput);
    if (exit <= join) { alert("퇴사일은 입사일보다 이후여야 합니다!"); return; }
    const enablePromotion = document.getElementById('enable-promotion');
    const isPromotion = enablePromotion ? enablePromotion.checked : false;
    const totalJoin = renderJoinBasis(join, exit, isPromotion);
    const totalAccounting = renderAccountingBasis(join, exit, isPromotion);
    const maxTotal = Math.max(totalJoin, totalAccounting);
    const usedDays = Number(document.getElementById('used-leave').value) || 0;
    const remainDays = maxTotal - usedDays;
    updateLeaveTracker(maxTotal, usedDays, remainDays);
    updateSummaryBanner(
        Math.max(0, remainDays),
        totalJoin >= totalAccounting ? '입사일 기준' : '회계연도 기준',
        isPromotion
    );
}

function renderJoinBasis(join, exit, isPromotion) {
    const tbody = document.querySelector('#join-basis-table tbody');
    if (!tbody) return 0;
    tbody.innerHTML = '';
    const rows = [];

    if (join >= LAW_CHANGE_DATE) {
        let firstM = getActualMonths(join, exit);
        if (firstM > 0) rows.push({ c1: "1년차 미만", c2: "매월 개근 시 발생", val: firstM });
    } else {
        rows.push({ c1: "1년차 미만", c2: "구법 대상 (월차 없음)", val: 0 });
    }

    let year = 1;
    while (true) {
        let d = new Date(join);
        d.setFullYear(join.getFullYear() + year);
        if (d > exit) break;
        let leave = Math.min(25, year >= 2 ? 15 + Math.floor((year - 1) / 2) : 15);
        rows.push({ c1: `${year + 1}년차`, c2: d.toLocaleDateString(), val: leave });
        year++;
    }

    if (isPromotion && rows.length > 0) {
        for (let i = 0; i < rows.length - 1; i++) {
            rows[i].val = 0;
            rows[i].c2 += " <span style='color:#ff4d4d; font-size:11px;'>(소멸)</span>";
        }
    }

    let total = 0;
    rows.forEach(row => {
        total += row.val;
        addRow(tbody, row.c1, row.c2, row.val.toFixed(1));
    });
    addRow(tbody, "합계",
        isPromotion ? "<span style='color:#764ba2; font-size:11px;'>촉진제 적용</span>" : "-",
        total.toFixed(1)
    );
    return total;
}

function renderAccountingBasis(join, exit, isPromotion) {
    const tbody = document.querySelector('#accounting-basis-table tbody');
    if (!tbody) return 0;
    tbody.innerHTML = '';
    const rows = [];
    const joinYear = join.getFullYear();
    const nextJan1 = new Date(joinYear + 1, 0, 1);
    const oneYearAnn = new Date(join);
    oneYearAnn.setFullYear(joinYear + 1);

    // 월차 계산 (2017년 개정법 이후)
    if (join >= LAW_CHANGE_DATE) {
        let firstYMonthly = 0;
        for (let i = 1; i <= 11; i++) {
            let d = new Date(join); d.setMonth(join.getMonth() + i);
            if (d < nextJan1 && d <= exit) firstYMonthly++;
        }
        if (firstYMonthly > 0) rows.push({ c1: joinYear, c2: "입사년 월차", val: firstYMonthly });

        if (nextJan1 <= exit) {
            let secondYMonthly = 0;
            for (let i = 1; i <= 11; i++) {
                let d = new Date(join); d.setMonth(join.getMonth() + i);
                if (d >= nextJan1 && d < oneYearAnn && d <= exit) secondYMonthly++;
            }
            if (secondYMonthly > 0) rows.push({ c1: nextJan1.getFullYear(), c2: "잔여 월차", val: secondYMonthly });
        }
    }

    // 비례분 계산 (윤년 반영)
    if (nextJan1 <= exit) {
        const isLeapYear = (joinYear % 4 === 0 && joinYear % 100 !== 0) || (joinYear % 400 === 0);
        const daysInYear = isLeapYear ? 366 : 365;
        let prop = 15 * ((nextJan1 - join) / (1000 * 60 * 60 * 24) / daysInYear);
        rows.push({ c1: nextJan1.getFullYear(), c2: "연차 비례분", val: prop });
    }

    // ✅ 수정된 정기 연차
    let curYear = joinYear + 2;
    while (true) {
        let d = new Date(curYear, 0, 1);
        if (d > exit) break;

        const isJan1 = (join.getMonth() === 0 && join.getDate() === 1);
        const fullYears = isJan1
            ? (curYear - joinYear)
            : (curYear - joinYear - 1);

        const leave = Math.min(25, 15 + Math.floor((fullYears - 1) / 2));

        rows.push({ c1: curYear, c2: `${fullYears + 1}년차 정기`, val: leave });
        curYear++;
    }

    // 촉진제 적용
    if (isPromotion && rows.length > 0) {
        for (let i = 0; i < rows.length - 1; i++) {
            rows[i].val = 0;
            rows[i].c2 += " <span style='color:#ff4d4d; font-size:11px;'>(소멸)</span>";
        }
    }

    let total = 0;
    rows.forEach(row => {
        total += row.val;
        addRow(tbody, row.c1, row.c2, row.val.toFixed(1));
    });
    addRow(tbody, "합계",
        isPromotion ? "<span style='color:#764ba2; font-size:11px;'>촉진제 적용</span>" : "-",
        total.toFixed(1)
    );
    return total;
}

function getActualMonths(startDate, endDate) {
    let months = 0;
    let currentDate = new Date(startDate);
    while (currentDate < endDate) {
        currentDate.setMonth(currentDate.getMonth() + 1);
        if (currentDate <= endDate) months++;
        if (months >= 11) break;
    }
    return months;
}

function updateLeaveTracker(total, used, remain) {
    const trackerTotal = document.getElementById('tracker-total');
    const trackerUsed = document.getElementById('tracker-used');
    const remainEl = document.getElementById('tracker-remain');
    const sendBtn = document.getElementById('auto-send-btn');
    const warning = document.getElementById('tracker-warning');
    const tracker = document.getElementById('leave-tracker');

    if (trackerTotal) trackerTotal.textContent = total.toFixed(1) + '일';
    if (trackerUsed) trackerUsed.textContent = used.toFixed(1) + '일';

    if (remainEl) {
        if (remain < 0) {
            remainEl.textContent = remain.toFixed(1) + '일';
            remainEl.className = 'tracker-value danger';
            if (warning) warning.style.display = 'block';
            if (sendBtn) sendBtn.disabled = true;
        } else {
            remainEl.textContent = remain.toFixed(1) + '일';
            remainEl.className = 'tracker-value remain';
            if (warning) warning.style.display = 'none';
            if (sendBtn) sendBtn.disabled = remain === 0;
        }
    }
    if (tracker) tracker.style.display = 'block';
}

function updateSummaryBanner(remainDays, basisType, isPromotion) {
    const bannerAmount = document.getElementById('banner-amount');
    const bannerSub = document.getElementById('banner-sub');
    const summaryBanner = document.getElementById('summary-banner');
    if (bannerAmount) bannerAmount.textContent = remainDays.toFixed(1) + '일';
    if (bannerSub) {
        bannerSub.textContent = isPromotion
            ? `${basisType} 적용 · 촉진제로 이전 연차 소멸`
            : `${basisType} 적용 (근로자 유리 기준)`;
    }
    if (summaryBanner) summaryBanner.style.display = 'block';
}

function sendToMoneyTab() {
    const remainEl = document.getElementById('tracker-remain');
    if (!remainEl) { alert('연차 계산을 먼저 완료해주세요.'); return; }
    const remainValue = parseFloat(remainEl.textContent);
    if (remainValue <= 0) { alert('잔여 연차가 없거나 초과 사용 상태입니다!'); return; }
    openTab('money-tab');
    const input = document.getElementById('unused-days');
    if (input) {
        input.value = remainValue.toFixed(1);
        input.style.borderColor = '#764ba2';
        input.style.background = '#fdfaff';
        setTimeout(() => {
            input.style.borderColor = '#eee';
            input.style.background = 'white';
        }, 2000);
    }
    alert(`✅ 잔여 연차 ${remainValue.toFixed(1)}일이 수당 계산에 자동 입력되었습니다!`);
}

function addAllowanceField() {
    const list = document.getElementById('allowance-list');
    if (!list) return;
    const row = document.createElement('div');
    row.className = 'allowance-row';
    row.innerHTML = `
        <input type="text" placeholder="수당명(식대 등)" style="width:55%">
        <input type="text" inputmode="numeric" placeholder="금액" class="allowance-value" style="width:30%">
        <button class="remove-btn" onclick="this.parentElement.remove()">×</button>
    `;
    const newAmountInput = row.querySelector('.allowance-value');
    newAmountInput.addEventListener('input', function() { applyCommaFormat(this); });
    newAmountInput.addEventListener('paste', function() { setTimeout(() => applyCommaFormat(this), 0); });
    list.appendChild(row);
}

function toggleSalaryType() {
    const isYearly = document.getElementById('type-yearly').checked;
    const label = document.getElementById('base-salary-label');
    const input = document.getElementById('base-salary');
    const hint = document.getElementById('converted-salary-hint');
    if (label) label.textContent = isYearly ? '계약 연봉 (원)' : '기본급 (월/원)';
    if (input) input.placeholder = isYearly ? '예: 36,000,000' : '예: 2,500,000';
    if (hint) hint.style.display = isYearly ? 'block' : 'none';
    updateConvertedSalary();
}

function updateConvertedSalary() {
    const typeYearly = document.getElementById('type-yearly');
    const baseSalary = document.getElementById('base-salary');
    const convertedAmount = document.getElementById('converted-amount');
    if (typeYearly && typeYearly.checked && baseSalary && convertedAmount) {
        const val = parseNumber(baseSalary.value);
        convertedAmount.textContent = Math.floor(val / 12).toLocaleString('ko-KR');
    }
}

function toggleAverageWage() {
    const enableAverage = document.getElementById('enable-average-wage');
    const inputs = document.getElementById('average-wage-inputs');
    if (enableAverage && inputs) {
        inputs.style.display = enableAverage.checked ? 'block' : 'none';
    }
}

function calculate3MonthsDetailedInfo() {
    const joinInput = document.getElementById('join-date').value;
    const exitInput = document.getElementById('exit-date').value;
    if (!exitInput) return { days: 90, label: '기본값 (퇴사일 미입력)', isShortTerm: false };
    const joinDate = joinInput ? new Date(joinInput) : null;
    const exitDate = new Date(exitInput);
    const threeMonthsBefore = new Date(exitDate);
    threeMonthsBefore.setMonth(threeMonthsBefore.getMonth() - 3);
    let startDate = threeMonthsBefore;
    let isShortTerm = false;
    if (joinDate && joinDate > threeMonthsBefore) {
        startDate = new Date(joinDate);
        isShortTerm = true;
    }
    const endDate = new Date(exitDate);
    endDate.setDate(endDate.getDate() - 1);
    const totalDays = Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
    const fmt = (d) => `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
    const label = `${fmt(startDate)} ~ ${fmt(endDate)} = ${totalDays}일${isShortTerm ? ' (3개월 미만 특례)' : ''}`;
    return { days: totalDays, label, isShortTerm };
}

function calculateMoney() {
    let base = parseNumber(document.getElementById('base-salary').value);
    const isYearly = document.getElementById('type-yearly').checked;
    if (base <= 0) { alert("기본급을 올바르게 입력해주세요!"); return; }
    if (isYearly) base = Math.floor(base / 12);
    const totalDays = parseNumber(document.getElementById('unused-days').value);
    if (totalDays <= 0) { alert("미사용 연차 일수를 입력해주세요!"); return; }

    let adds = 0;
    document.querySelectorAll('.allowance-value').forEach(i => adds += parseNumber(i.value));
    const totalOrdinaryWage = base + adds;
    const hourlyPay = totalOrdinaryWage / 209;
    const dailyOrdinary = hourlyPay * 8;

    const isAverageEnabled = document.getElementById('enable-average-wage').checked;
    let dailyAverage = 0, averageCalculated = false;
    let total3M = 0, bonusIncluded = 0, leavePayIncluded = 0, grandTotal = 0;
    let periodInfo = { days: 90, label: '-', isShortTerm: false };

    if (isAverageEnabled) {
        const month1 = parseNumber(document.getElementById('month1-salary').value);
        const month2 = parseNumber(document.getElementById('month2-salary').value);
        const month3 = parseNumber(document.getElementById('month3-salary').value);
        const annualBonus = parseNumber(document.getElementById('annual-bonus').value);
        const annualLeavePay = parseNumber(document.getElementById('annual-leave-pay').value);
        total3M = month1 + month2 + month3;
        bonusIncluded = Math.floor(annualBonus * 3 / 12);
        leavePayIncluded = Math.floor(annualLeavePay * 3 / 12);
        grandTotal = total3M + bonusIncluded + leavePayIncluded;
        periodInfo = calculate3MonthsDetailedInfo();
        if (grandTotal > 0) {
            dailyAverage = grandTotal / periodInfo.days;
            averageCalculated = true;
        }
    }

    const dailyUsed = Math.max(dailyOrdinary, dailyAverage);
    const appliedBasis = (averageCalculated && dailyAverage > dailyOrdinary) ? '평균임금' : '통상임금';
    const finalMoney = dailyUsed * totalDays;

    const tbody = document.querySelector('#money-result-table tbody');
    if (!tbody) return;

    let tableHTML = `
        <tr><td colspan="3" style="background:#f0f4ff; font-weight:600; color:#667eea; padding:12px; text-align:center;">🏛️ 통상임금 계산 내역</td></tr>
        <tr><td>월 기본급</td><td>${isYearly ? '연봉 ÷ 12개월' : '직접 입력'}</td><td>${base.toLocaleString('ko-KR')} 원</td></tr>
        <tr><td>월 통상임금</td><td>기본급 + 고정수당</td><td>${totalOrdinaryWage.toLocaleString('ko-KR')} 원</td></tr>
        <tr><td>통상 시급</td><td>월 통상임금 ÷ 209시간</td><td>${Math.floor(hourlyPay).toLocaleString('ko-KR')} 원</td></tr>
        <tr><td>통상임금 1일분</td><td>시급 × 8시간</td><td>${Math.floor(dailyOrdinary).toLocaleString('ko-KR')} 원</td></tr>
    `;

    if (averageCalculated) {
        tableHTML += `
            <tr><td colspan="3" style="background:#f8f9ff; font-weight:600; color:#667eea; padding:12px; text-align:center;">📊 평균임금 계산 내역 (근로기준법 제19조)</td></tr>
            <tr><td>평균임금 계산기간</td><td colspan="2" style="color:#555; font-size:12px;">${periodInfo.label}</td></tr>
            <tr><td>3개월 임금총액</td><td>최근 3개월 실수령 합계</td><td>${total3M.toLocaleString('ko-KR')} 원</td></tr>
            <tr><td>연간 상여금 산입액</td><td>연간 상여금 × 3/12</td><td>${bonusIncluded.toLocaleString('ko-KR')} 원</td></tr>
            <tr><td>연간 연차수당 산입액</td><td>연간 연차수당 × 3/12</td><td>${leavePayIncluded.toLocaleString('ko-KR')} 원</td></tr>
            <tr><td>평균임금 산정 총액</td><td>3개월 임금 + 상여 + 연차수당</td><td>${grandTotal.toLocaleString('ko-KR')} 원</td></tr>
            <tr><td>평균임금 계산 총일수</td><td>달력 기준${periodInfo.isShortTerm ? ' (특례)' : ''}</td><td>${periodInfo.days}일</td></tr>
            <tr><td>평균임금 1일분</td><td>산정총액 ÷ ${periodInfo.days}일</td><td>${Math.floor(dailyAverage).toLocaleString('ko-KR')} 원</td></tr>
        `;
    }

    tableHTML += `
        <tr class="applied-basis-row">
            <td><strong>✅ 적용 기준</strong></td>
            <td colspan="2"><strong>${appliedBasis} 기준 적용 (근로기준법 제19조·제60조)</strong></td>
        </tr>
        <tr style="background:#f3ebff; font-weight:bold; color:#764ba2;">
            <td>최종 수당 예상액</td>
            <td>수당 대상 ${totalDays}일 × ${Math.floor(dailyUsed).toLocaleString('ko-KR')}원</td>
            <td>${Math.floor(finalMoney).toLocaleString('ko-KR')} 원</td>
        </tr>
    `;

    tbody.innerHTML = tableHTML;
}

function collectCurrentCalculationData() {
    const allowances = [];
    document.querySelectorAll('.allowance-row').forEach(row => {
        const name = row.children[0].value;
        const amount = parseNumber(row.children[1].value);
        if (name && amount > 0) allowances.push({ name, amount });
    });

    const totalLeave = document.getElementById('tracker-total') ? parseFloat(document.getElementById('tracker-total').textContent) : 0;
    const usedLeave = document.getElementById('tracker-used') ? parseFloat(document.getElementById('tracker-used').textContent) : 0;
    const remainLeave = document.getElementById('tracker-remain') ? parseFloat(document.getElementById('tracker-remain').textContent) : 0;

    let finalAllowance = 0, dailyOrdinary = 0, dailyAverage = 0, appliedBasis = '통상임금';
    document.querySelectorAll('#money-result-table tbody tr').forEach(row => {
        const cells = row.cells;
        if (cells.length >= 3) {
            const label = cells[0].textContent.trim();
            const amount = cells[2].textContent.replace(/[^0-9]/g, '');
            if (label.includes('최종 수당')) finalAllowance = parseInt(amount) || 0;
            else if (label.includes('통상임금 1일분')) dailyOrdinary = parseInt(amount) || 0;
            else if (label.includes('평균임금 1일분')) dailyAverage = parseInt(amount) || 0;
            else if (label.includes('적용 기준')) {
                appliedBasis = cells[2] && cells[2].textContent.includes('평균임금') ? '평균임금' : '통상임금';
            }
        }
    });

    const bannerSub = document.getElementById('banner-sub');
    const basisType = bannerSub && bannerSub.textContent.includes('입사일') ? '입사일 기준' : '회계연도 기준';

    currentCalculationData = {
        inputs: {
            joinDate: document.getElementById('join-date') ? document.getElementById('join-date').value : '',
            exitDate: document.getElementById('exit-date') ? document.getElementById('exit-date').value : '',
            usedLeave: document.getElementById('used-leave') ? Number(document.getElementById('used-leave').value) || 0 : 0,
            promotionEnabled: document.getElementById('enable-promotion') ? document.getElementById('enable-promotion').checked : false,
            salaryType: document.getElementById('type-yearly') && document.getElementById('type-yearly').checked ? 'yearly' : 'monthly',
            baseSalary: document.getElementById('base-salary') ? parseNumber(document.getElementById('base-salary').value) : 0,
            allowances,
            averageWageEnabled: document.getElementById('enable-average-wage') ? document.getElementById('enable-average-wage').checked : false,
            month1Salary: document.getElementById('month1-salary') ? parseNumber(document.getElementById('month1-salary').value) : 0,
            month2Salary: document.getElementById('month2-salary') ? parseNumber(document.getElementById('month2-salary').value) : 0,
            month3Salary: document.getElementById('month3-salary') ? parseNumber(document.getElementById('month3-salary').value) : 0,
            annualBonus: document.getElementById('annual-bonus') ? parseNumber(document.getElementById('annual-bonus').value) : 0,
            annualLeavePay: document.getElementById('annual-leave-pay') ? parseNumber(document.getElementById('annual-leave-pay').value) : 0,
            unusedDays: document.getElementById('unused-days') ? Number(document.getElementById('unused-days').value) || 0 : 0
        },
        results: {
            basisType,
            totalLeave,
            usedLeave,
            remainLeave: Math.max(0, remainLeave),
            promotionApplied: document.getElementById('enable-promotion') ? document.getElementById('enable-promotion').checked : false,
            appliedBasis,
            dailyOrdinary,
            dailyAverage,
            finalAllowance
        }
    };
}

function showSaveModal() {
    if (!currentCalculationData) {
        alert('저장할 계산 데이터가 없습니다. 먼저 계산을 완료해주세요.');
        return;
    }
    const modal = document.getElementById('save-modal');
    const backdrop = document.getElementById('modal-backdrop');
    const titleInput = document.getElementById('save-title');
    if (modal) modal.style.display = 'flex';
    if (backdrop) backdrop.style.display = 'block';
    if (titleInput) {
        titleInput.value = '';
        setTimeout(() => titleInput.focus(), 100);
    }
}

function closeSaveModal() {
    const modal = document.getElementById('save-modal');
    const backdrop = document.getElementById('modal-backdrop');
    if (modal) modal.style.display = 'none';
    if (backdrop) backdrop.style.display = 'none';
}

function saveCalculationResult() {
    const titleInput = document.getElementById('save-title');
    if (!titleInput) return;
    const title = titleInput.value.trim();
    if (!title) { alert('저장할 이름을 입력해주세요.'); return; }
    if (!currentCalculationData) { alert('저장할 데이터가 없습니다.'); return; }
    const history = JSON.parse(localStorage.getItem('annualCalculatorHistory') || '[]');
    const record = {
        id: Date.now().toString(),
        title,
        createdAt: new Date().toISOString(),
        ...currentCalculationData
    };
    history.push(record);
    localStorage.setItem('annualCalculatorHistory', JSON.stringify(history));
    closeSaveModal();
    alert(`"${title}" 계산 내역이 저장되었습니다!`);
    if (currentTab !== 'history-tab') {
        setTimeout(() => {
            if (confirm('저장된 내역을 확인하시겠습니까?')) {
                openTab('history-tab');
            }
        }, 500);
    }
}

function renderHistoryList() {
    const history = JSON.parse(localStorage.getItem('annualCalculatorHistory') || '[]');
    const listContainer = document.getElementById('history-list');
    const countElement = document.getElementById('history-count');
    if (countElement) countElement.textContent = `저장된 내역: ${history.length}건`;
    if (!listContainer) return;
    if (history.length === 0) {
        listContainer.innerHTML = `
            <div class="empty-history">
                <p>💾 저장된 계산 내역이 없습니다</p>
                <p>연차나 수당 계산 후 "💾 이 결과 저장하기" 버튼을 눌러보세요!</p>
            </div>
        `;
        return;
    }
    const sortedHistory = [...history].reverse();
    listContainer.innerHTML = sortedHistory.map(item => {
        const createdDate = new Date(item.createdAt).toLocaleString('ko-KR');
        const allowanceText = item.inputs.allowances && item.inputs.allowances.length > 0
            ? item.inputs.allowances.map(a => `${a.name}:${Number(a.amount).toLocaleString()}`).join('|')
            : '없음';
        return `
            <div class="history-item" data-title="${item.title.toLowerCase()}">
                <div class="history-main">
                    <div class="history-info">
                        <h4>${item.title}</h4>
                        <div class="history-meta">
                            <span>📅 ${createdDate}</span>
                            <span>📊 ${item.results.basisType || '-'}</span>
                            <span>🏛️ ${item.results.appliedBasis || '-'}</span>
                            ${item.results.promotionApplied ? '<span style="color:#ff4d4d;">🚫 촉진제</span>' : ''}
                        </div>
                    </div>
                    <div class="history-actions">
                        <button class="btn-load" onclick="loadHistoryData('${item.id}')">불러오기</button>
                        <button class="btn-delete" onclick="deleteHistoryItem('${item.id}')">삭제</button>
                    </div>
                </div>
                <div class="history-summary">
                    <div class="summary-row">
                        <span class="summary-label">입사일 → 퇴사일:</span>
                        <span class="summary-value">${item.inputs.joinDate} → ${item.inputs.exitDate}</span>
                    </div>
                    <div class="summary-row">
                        <span class="summary-label">총 발생 / 사용 / 잔여:</span>
                        <span class="summary-value">${item.results.totalLeave}일 / ${item.results.usedLeave}일 / ${item.results.remainLeave}일</span>
                    </div>
                    <div class="summary-row">
                        <span class="summary-label">기본급 / 수당:</span>
                        <span class="summary-value">${Number(item.inputs.baseSalary).toLocaleString()}원 / ${allowanceText}</span>
                    </div>
                    <div class="summary-row">
                        <span class="summary-label">최종 수당 예상액:</span>
                        <span class="summary-value" style="color:#764ba2; font-weight:bold;">${Number(item.results.finalAllowance).toLocaleString()}원</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function filterHistory() {
    const searchInput = document.getElementById('history-search');
    if (!searchInput) return;
    const searchTerm = searchInput.value.toLowerCase();
    document.querySelectorAll('.history-item').forEach(item => {
        const title = item.dataset.title;
        item.style.display = title.includes(searchTerm) ? 'block' : 'none';
    });
}

function loadHistoryData(id) {
    const history = JSON.parse(localStorage.getItem('annualCalculatorHistory') || '[]');
    const item = history.find(h => h.id === id);
    if (!item) { alert('해당 데이터를 찾을 수 없습니다.'); return; }
    const safeSetValue = (elementId, value) => {
        const el = document.getElementById(elementId);
        if (el) el.value = value;
    };
    const safeSetChecked = (elementId, checked) => {
        const el = document.getElementById(elementId);
        if (el) el.checked = checked;
    };
    safeSetValue('join-date', item.inputs.joinDate);
    safeSetValue('exit-date', item.inputs.exitDate);
    safeSetValue('used-leave', item.inputs.usedLeave);
    safeSetChecked('enable-promotion', item.inputs.promotionEnabled);
    if (item.inputs.salaryType === 'yearly') {
        safeSetChecked('type-yearly', true);
    } else {
        safeSetChecked('type-monthly', true);
    }
    toggleSalaryType();
    safeSetValue('base-salary', Number(item.inputs.baseSalary).toLocaleString());
    const allowanceList = document.getElementById('allowance-list');
    if (allowanceList) {
        allowanceList.innerHTML = '';
        (item.inputs.allowances || []).forEach(allowance => {
            addAllowanceField();
            const rows = allowanceList.querySelectorAll('.allowance-row');
            const lastRow = rows[rows.length - 1];
            if (lastRow) {
                lastRow.children[0].value = allowance.name;
                lastRow.children[1].value = Number(allowance.amount).toLocaleString();
                applyCommaFormat(lastRow.children[1]);
            }
        });
    }
    safeSetChecked('enable-average-wage', item.inputs.averageWageEnabled);
    toggleAverageWage();
    if (item.inputs.averageWageEnabled) {
        const fields = {
            'month1-salary': item.inputs.month1Salary,
            'month2-salary': item.inputs.month2Salary,
            'month3-salary': item.inputs.month3Salary,
            'annual-bonus': item.inputs.annualBonus,
            'annual-leave-pay': item.inputs.annualLeavePay
        };
        Object.entries(fields).forEach(([id, val]) => {
            const el = document.getElementById(id);
            if (el) {
                el.value = Number(val).toLocaleString();
                applyCommaFormat(el);
            }
        });
    }
    safeSetValue('unused-days', item.inputs.unusedDays);
    openTab('leave-tab');
    setTimeout(() => {
        mainCalculate();
        alert(`"${item.title}" 내역을 불러왔습니다!`);
    }, 100);
}

function deleteHistoryItem(id) {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    let history = JSON.parse(localStorage.getItem('annualCalculatorHistory') || '[]');
    history = history.filter(h => h.id !== id);
    localStorage.setItem('annualCalculatorHistory', JSON.stringify(history));
    renderHistoryList();
    alert('삭제되었습니다.');
}

function clearAllHistory() {
    const history = JSON.parse(localStorage.getItem('annualCalculatorHistory') || '[]');
    if (history.length === 0) { alert('삭제할 내역이 없습니다.'); return; }
    if (!confirm(`정말 모든 저장 내역(${history.length}건)을 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`)) return;
    localStorage.removeItem('annualCalculatorHistory');
    renderHistoryList();
    alert('모든 저장 내역이 삭제되었습니다.');
}

function exportToExcel() {
    const history = JSON.parse(localStorage.getItem('annualCalculatorHistory') || '[]');
    if (history.length === 0) { alert('다운로드할 데이터가 없습니다.'); return; }
    const headers = [
        '저장ID', '제목', '저장일시', '입사일', '퇴사일', '기준',
        '총발생연차', '사용연차', '잔여연차', '촉진제적용여부',
        '급여기준', '기본급', '수당합계', '평균임금사용여부',
        '3개월총임금', '연간상여금', '상여금산입액',
        '연간연차수당', '연차수당산입액', '통상임금1일분',
        '평균임금1일분', '적용임금기준', '미사용연차일수',
        '최종수당예상액', '수당상세내역'
    ];
    const dataRows = history.map(item => {
        const allowances = item.inputs.allowances || [];
        const allowanceTotal = allowances.reduce((sum, a) => sum + a.amount, 0);
        const allowanceDetail = allowances.length > 0
            ? allowances.map(a => `${a.name}:${a.amount}`).join(' | ')
            : '없음';
        const bonusIncluded = Math.floor((item.inputs.annualBonus || 0) * 3 / 12);
        const leavePayIncluded = Math.floor((item.inputs.annualLeavePay || 0) * 3 / 12);
        const total3M = (item.inputs.month1Salary || 0) +
                        (item.inputs.month2Salary || 0) +
                        (item.inputs.month3Salary || 0);
        return [
            item.id, item.title,
            new Date(item.createdAt).toLocaleString('ko-KR'),
            item.inputs.joinDate, item.inputs.exitDate,
            item.results.basisType || '',
            item.results.totalLeave || 0, item.results.usedLeave || 0, item.results.remainLeave || 0,
            item.results.promotionApplied ? 'Y' : 'N',
            item.inputs.salaryType === 'yearly' ? '연봉' : '월급',
            item.inputs.baseSalary || 0, allowanceTotal,
            item.inputs.averageWageEnabled ? 'Y' : 'N',
            total3M, item.inputs.annualBonus || 0, bonusIncluded,
            item.inputs.annualLeavePay || 0, leavePayIncluded,
            item.results.dailyOrdinary || 0, item.results.dailyAverage || 0,
            item.results.appliedBasis || '',
            item.inputs.unusedDays || 0, item.results.finalAllowance || 0,
            allowanceDetail
        ];
    });
    const worksheetData = [headers, ...dataRows];
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    worksheet['!cols'] = [
        { wch: 15 }, { wch: 25 }, { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 14 },
        { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 15 },
        { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
        { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 14 }, { wch: 15 }, { wch: 15 }, { wch: 35 }
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '연차수당계산내역');
    const fileName = `연차수당_계산내역_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.xlsx`;
    XLSX.writeFile(workbook, fileName);
    alert(`${history.length}건의 계산 내역이 엑셀 파일(.xlsx)로 다운로드되었습니다!`);
}

document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('input[type="date"]').forEach(input => {
        input.addEventListener('input', function() { limitDateYearInput(this); });
        input.addEventListener('change', function() { limitDateYearInput(this); });
    });
    ['base-salary', 'month1-salary', 'month2-salary', 'month3-salary', 'annual-bonus', 'annual-leave-pay']
        .forEach(id => attachMoneyFormat(id));
    const unusedDaysInput = document.getElementById('unused-days');
    if (unusedDaysInput) {
        unusedDaysInput.setAttribute('inputmode', 'decimal');
        unusedDaysInput.addEventListener('input', function() {
            this.value = this.value.replace(/[^0-9.]/g, '');
        });
    }
    const salaryInput = document.getElementById('base-salary');
    if (salaryInput) salaryInput.addEventListener('input', updateConvertedSalary);
    const usedLeaveInput = document.getElementById('used-leave');
    if (usedLeaveInput) {
        usedLeaveInput.addEventListener('input', function() {
            const leaveReport = document.getElementById('leave-report');
            if (leaveReport && leaveReport.style.display !== 'none') calculateLeave();
        });
    }
    const saveInput = document.getElementById('save-title');
    if (saveInput) {
        saveInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') saveCalculationResult();
        });
    }
});

if (document.readyState !== 'loading') {
    document.querySelectorAll('input[type="date"]').forEach(input => {
        input.addEventListener('input', function() { limitDateYearInput(this); });
        input.addEventListener('change', function() { limitDateYearInput(this); });
    });
}