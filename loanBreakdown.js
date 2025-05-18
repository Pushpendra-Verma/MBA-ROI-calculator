// Track payment method for each term (default: All terms Loan)
const termPaymentMethods = {
    1: 'loan',
    2: 'loan',
    3: 'loan',
    4: 'loan',
    5: 'loan',
    6: 'loan'
};

// Initialize Pie Chart
const ctx = document.getElementById('loanBreakdownChart').getContext('2d');
let loanBreakdownChart = new Chart(ctx, {
    type: 'pie',
    data: {
        labels: ['Principal', 'Interest'],
        datasets: [{
            data: [0, 0],
            backgroundColor: ['#1a73e8', '#83b4ff'],
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
                        family: 'Roboto',
                        size: 12
                    },
                    color: '#555'
                }
            },
            title: {
                display: true,
                text: 'Loan Breakdown: Principal vs Interest',
                font: {
                    family: 'Roboto',
                    size: 14,
                    weight: '500'
                },
                color: '#333',
                padding: {
                    bottom: 20
                }
            },
            tooltip: {
                callbacks: {
                    label: function (context) {
                        let label = context.label || '';
                        if (label) label += ': ';
                        label += '₹' + context.raw.toLocaleString('en-IN');
                        return label;
                    }
                }
            }
        }
    }
});

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
    calculateLoan();
}

function toggleTermPayment(term) {
    const toggle = document.getElementById(`term${term}-toggle`);
    termPaymentMethods[term] = toggle.checked ? 'loan' : 'paid';
    calculateLoan();
}

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
    const moratoriumMonths = 36;
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

        // Compound Interest: A = P * (1 + r)^t => Interest = A - P
        const compoundInterest = amount * Math.pow(1 + annualRate, years) - amount;
        totalMoratoriumInterest += compoundInterest;

        // CSIS calculation
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

    // EMI Calculation after Moratorium
    const r = monthlyRate;
    const n = repaymentMonths;
    const emi = (r === 0 || n === 0) ? principalAfter / (n || 1) :
        (principalAfter * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);

    const totalRepayment = emi * n;
    const repaymentInterest = totalRepayment - principalAfter;

    const totalInterest = interestMoratorium + repaymentInterest;
    const totalCost = totalRepayment + totalCashPaid;

    // Without CSIS (for comparison)
    const principalNoCSIS = loanAmount + totalMoratoriumInterest;
    const emiNoCSIS = (r === 0 || n === 0) ? principalNoCSIS / (n || 1) :
        (principalNoCSIS * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    const totalRepaymentNoCSIS = emiNoCSIS * n;
    const totalCostNoCSIS = totalRepaymentNoCSIS + totalCashPaid;
    const savings = totalCostNoCSIS - totalCost;

    // Update UI
    document.getElementById('loan-amount').textContent = formatNumber(loanAmount);
    document.getElementById('interest-moratorium').textContent = formatNumber(interestMoratorium);
    document.getElementById('principal-after').textContent = formatNumber(principalAfter);
    document.getElementById('monthly-emi').textContent = formatNumber(emi);
    document.getElementById('total-repayment').textContent = formatNumber(totalRepayment);
    document.getElementById('total-interest').textContent = formatNumber(totalInterest);
    document.getElementById('total-cost').textContent = formatNumber(totalCost);
    document.getElementById('savings').textContent = formatNumber(savings);

    loanBreakdownChart.data.datasets[0].data = [loanAmount, totalInterest];
    loanBreakdownChart.update();
}


// Debounce function to limit how often calculateLoan is called
let debounceTimeout;
function debouncedCalculateLoan() {
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(calculateLoan, 300); // 300ms debounce
}

// Initial calculation on page load
calculateLoan();
