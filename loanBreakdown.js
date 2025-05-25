const termPaymentMethods = {
    1: 'paid',
    2: 'loan',
    3: 'loan',
    4: 'loan',
    5: 'loan',
    6: 'loan'
};

let loanBreakdownChart = null;

function formatNumber(num) {
    return '₹' + num.toLocaleString('en-IN', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    });
}

function toggleCSIS() {
    const csisToggle = document.getElementById('csis-toggle').checked;
    const csisElements = document.querySelectorAll('.csis-related');
    csisElements.forEach(element => {
        element.classList.toggle('csis-hidden', !csisToggle);
    });
    debouncedCalculateLoan();
}

function toggleTermPayment(term) {
    const toggle = document.getElementById(`term${term}-toggle`);
    termPaymentMethods[term] = toggle.checked ? 'loan' : 'paid';
    debouncedCalculateLoan();
}

['moratorium-months', 'term1-fee', 'term2-fee', 'term3-fee', 'term4-fee', 'term5-fee', 'term6-fee', 'interest-rate', 'repayment-months'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
        el.addEventListener('input', debouncedCalculateLoan);
    }
});

function calculateLoan() {
    const csisEnabled = document.getElementById('csis-toggle').checked;

    const termFees = [
        parseFloat(document.getElementById('term1-fee').value) || 0,
        parseFloat(document.getElementById('term2-fee').value) || 0,
        parseFloat(document.getElementById('term3-fee').value) || 0,
        parseFloat(document.getElementById('term4-fee').value) || 0,
        parseFloat(document.getElementById('term5-fee').value) || 0,
        parseFloat(document.getElementById('term6-fee').value) || 0
    ];
    const interestRate = parseFloat(document.getElementById('interest-rate').value) || 0;
    const moratoriumMonths = parseFloat(document.getElementById('moratorium-months').value) || 0;
    const repaymentMonths = parseFloat(document.getElementById('repayment-months').value) || 0;

    let totalCashPaid = 0;
    termFees.forEach((fee, i) => {
        if (termPaymentMethods[i + 1] === 'paid') totalCashPaid += fee;
    });

    const isAllLoan = totalCashPaid === 0;
    const scenarioTitle = `Results (${csisEnabled ? 'With CSIS' : 'Without CSIS'}, ${isAllLoan ? 'All Loan' : 'Partial Cash Paid'})`;
    document.getElementById('result-table-title').textContent = scenarioTitle;

    const disbursementMonths = [0, 4, 8, 12, 16, 20];
    const totalFees = termFees.reduce((a, b) => a + b, 0);
    const loanAmount = totalFees - totalCashPaid;

    const disbursements = termFees.map((fee, i) => termPaymentMethods[i + 1] === 'paid' ? 0 : fee);
    const annualRate = interestRate / 100;
    const monthlyRate = annualRate / 12;

    let totalMoratoriumInterest = 0;
    let csisCoveredInterest = 0;
    let cumulativeLoan = 0;

    disbursements.forEach((amount, i) => {
        if (amount === 0) return;

        const monthsToRepayment = moratoriumMonths - disbursementMonths[i];
        const years = monthsToRepayment / 12;

        const compoundInterest = amount * Math.pow(1 + annualRate, years) - amount;
        totalMoratoriumInterest += compoundInterest;

        let coveredByCSIS = 0;
        const newCumulative = cumulativeLoan + amount;

        if (csisEnabled) {
            if (cumulativeLoan >= 1000000) {
                coveredByCSIS = 0;
            } else if (newCumulative <= 1000000) {
                coveredByCSIS = compoundInterest;
            } else {
                const eligibleAmount = 1000000 - cumulativeLoan;
                const ratio = eligibleAmount / amount;
                coveredByCSIS = compoundInterest * ratio;
            }
        }

        csisCoveredInterest += coveredByCSIS;
        cumulativeLoan = newCumulative;
    });

    const interestMoratorium = totalMoratoriumInterest - csisCoveredInterest;
    const principalAfter = loanAmount + interestMoratorium;

    const r = monthlyRate;
    const n = repaymentMonths;
    const emi = (r === 0 || n === 0) ? principalAfter / (n || 1) :
        (principalAfter * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);

    const totalRepayment = emi * n;
    const repaymentInterest = totalRepayment - principalAfter;

    const totalInterest = interestMoratorium + repaymentInterest;
    const totalCost = totalRepayment + totalCashPaid;

    const principalNoCSIS = loanAmount + totalMoratoriumInterest;
    const emiNoCSIS = (r === 0 || n === 0) ? principalNoCSIS / (n || 1) :
        (principalNoCSIS * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    const totalRepaymentNoCSIS = emiNoCSIS * n;
    const totalCostNoCSIS = totalRepaymentNoCSIS + totalCashPaid;
    const savings = totalCostNoCSIS - totalCost;

    document.getElementById('loan-amount').textContent = formatNumber(loanAmount);
    document.getElementById('interest-moratorium').textContent = formatNumber(interestMoratorium);
    document.getElementById('principal-after').textContent = formatNumber(principalAfter);
    document.getElementById('monthly-emi').textContent = formatNumber(emi);
    document.getElementById('total-repayment').textContent = formatNumber(totalRepayment);
    document.getElementById('total-interest').textContent = formatNumber(totalInterest);
    document.getElementById('total-cost').textContent = formatNumber(totalCost);
    document.getElementById('savings').textContent = formatNumber(savings);

    if (!loanBreakdownChart) {
        const ctx = document.getElementById('loanBreakdownChart').getContext('2d');
        loanBreakdownChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: ['Principal', 'Total Interest'],
                datasets: [{
                    data: [loanAmount, totalInterest],
                    backgroundColor: ['#1E88E5', '#F4511E'],
                    borderColor: ['#fff', '#fff'],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            font: {
                                size: 14,
                                family: 'Roboto'
                            },
                            color: '#333'
                        }
                    },
                    title: {
                        display: true,
                        text: 'Loan Breakdown',
                        font: {
                            size: 16,
                            family: 'Roboto'
                        },
                        color: '#333'
                    }
                },
                tooltips: {
                    callbacks: {
                        label: function(tooltipItem, data) {
                            const label = data.labels[tooltipItem.index];
                            const value = data.datasets[0].data[tooltipItem.index];
                            return `${label}: ₹${value.toLocaleString()}`;
                        }
                    }
                }
            }
        });
    } else {
        loanBreakdownChart.data.datasets[0].data = [loanAmount, totalInterest];
        loanBreakdownChart.update();
    }
}

let debounceTimeout;
function debouncedCalculateLoan() {
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(calculateLoan, 300);
}

calculateLoan();