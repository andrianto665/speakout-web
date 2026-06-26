/**
 * Payment Page Logic
 * Handle payment info, method selection, file upload, and submission
 */

// Global variables
let enrollmentId = null;
let selectedMethod = null;
let selectedFile = null;
let paymentData = null;

// Payment methods configuration
const PAYMENT_METHODS = {
    dana: {
        name: 'DANA',
        number: '0812-3456-7890',
        holder: 'LKP PalComTech',
        icon: '💙'
    },
    gopay: {
        name: 'GoPay',
        number: '0812-3456-7890',
        holder: 'LKP PalComTech',
        icon: '💚'
    },
    qris: {
        name: 'QRIS',
        description: 'Scan QR Code dari semua e-wallet & m-banking',
        icon: '📱'
    },
    bank_transfer: {
        name: 'Transfer Bank',
        bank: 'Bank Mandiri',
        number: '123-000-1234-567',
        holder: 'LKP PalComTech',
        icon: '🏦'
    }
};

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('Payment page loaded');
    
    // Check authentication
    if (!api.isLoggedIn()) {
        window.location.href = 'login.html';
        return;
    }
    
    // Get enrollment ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    enrollmentId = urlParams.get('enrollment_id');
    
    if (!enrollmentId) {
        showToast('Enrollment ID tidak ditemukan', 'error');
        setTimeout(() => window.location.href = 'dashboard.html', 2000);
        return;
    }
    
    // Load payment data
    loadPaymentData();
    
    // Setup file input
    setupFileInput();
});

// ============================================
// API FUNCTIONS
// ============================================

/**
 * Load payment info from API
 */
async function loadPaymentData() {
    try {
        const token = api.getToken();
        const response = await fetch(`http://127.0.0.1:8000/api/user/enrollments/${enrollmentId}/payment-info`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error('Gagal memuat data pembayaran');
        }
        
        const data = await response.json();
        
        if (data.success) {
            paymentData = data;
            renderPaymentInfo();
        } else {
            throw new Error(data.message || 'Gagal memuat data');
        }
        
    } catch (error) {
        console.error('Error loading payment data:', error);
        showToast(error.message, 'error');
        
        // If enrollment not found or already paid, redirect to dashboard
        if (error.message.includes('not found')) {
            setTimeout(() => window.location.href = 'dashboard.html', 2000);
        }
    }
}

/**
 * Render payment information to DOM
 */
function renderPaymentInfo() {
    const { enrollment, payment_methods } = paymentData;
    
    // Update status banner
    updateStatusBanner(enrollment.status);
    
    // Update course info
    document.getElementById('courseName').textContent = enrollment.course_title;
    document.getElementById('coursePrice').textContent = formatRupiah(enrollment.amount);
    
    // ✅ TAMBAH INI: Update instructor name
    const instructorEl = document.getElementById('courseInstructor');
    if (instructorEl) {
        instructorEl.textContent = '👨‍🏫 Instructor: ' + (enrollment.course_instructor || '-');
    }
    
    // Render payment methods
    renderPaymentMethods(payment_methods);
    
    // Hide loading overlay
    document.getElementById('loadingOverlay').style.display = 'none';
    
    // If already paid, show success state
    if (enrollment.status === 'paid') {
        showSuccessState();
    }
}

/**
 * Update status banner based on payment status
 */
function updateStatusBanner(status) {
    const banner = document.getElementById('statusBanner');
    const icon = banner.querySelector('.status-icon');
    const title = document.getElementById('statusTitle');
    const message = document.getElementById('statusMessage');
    
    banner.style.display = 'flex';
    banner.className = 'status-banner';
    
    switch(status) {
        case 'pending':
            banner.classList.add('pending');
            icon.textContent = '⏳';
            title.textContent = 'Menunggu Pembayaran';
            message.textContent = 'Silakan pilih metode pembayaran dan upload bukti transfer';
            break;
        case 'paid':
            banner.classList.add('paid');
            icon.textContent = '✅';
            title.textContent = 'Pembayaran Dikonfirmasi';
            message.textContent = 'Terima kasih! Kursus Anda sudah aktif dan bisa diakses';
            break;
        case 'rejected':
            banner.classList.add('rejected');
            icon.textContent = '❌';
            title.textContent = 'Pembayaran Ditolak';
            message.textContent = 'Silakan hubungi admin untuk informasi lebih lanjut';
            break;
    }
}

/**
 * Render payment methods grid
 */
function renderPaymentMethods(methods) {
    const container = document.getElementById('paymentMethods');
    container.innerHTML = '';
    
    Object.keys(methods).forEach(key => {
        const method = methods[key];
        const card = document.createElement('div');
        card.className = 'payment-method';
        card.onclick = () => selectPaymentMethod(key);
        card.innerHTML = `
            <div class="payment-method-icon">${method.icon}</div>
            <div class="payment-method-name">${method.name}</div>
            ${method.number ? `<div class="payment-method-detail">${method.number}</div>` : ''}
        `;
        container.appendChild(card);
    });
}

// ============================================
// PAYMENT METHOD SELECTION
// ============================================

/**
 * Handle payment method selection
 */
function selectPaymentMethod(method) {
    selectedMethod = method;
    
    // Update UI - remove selected from all, add to clicked
    document.querySelectorAll('.payment-method').forEach(card => {
        card.classList.remove('selected');
    });
    event.currentTarget.classList.add('selected');
    
    // Show payment details
    showPaymentDetails(method);
    
    // Show upload section
    document.getElementById('uploadSection').classList.add('show');
    
    // Scroll to upload section
    document.getElementById('uploadSection').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/**
 * Show payment details box
 */
function showPaymentDetails(method) {
    const details = PAYMENT_METHODS[method];
    const box = document.getElementById('paymentDetails');
    
    document.getElementById('detailMethod').textContent = details.name;
    document.getElementById('detailNumber').textContent = details.number || details.bank || '-';
    document.getElementById('detailHolder').textContent = details.holder || details.name_holder || '-';
    document.getElementById('detailAmount').textContent = formatRupiah(paymentData.enrollment.amount);
    
    box.classList.add('show');
}

// ============================================
// FILE UPLOAD HANDLING
// ============================================

/**
 * Setup file input event listeners
 */
function setupFileInput() {
    const fileInput = document.getElementById('fileInput');
    const uploadArea = document.getElementById('uploadArea');
    
    // Click to upload
    fileInput.addEventListener('change', function(e) {
        handleFileSelect(e.target.files[0]);
    });
    
    // Drag and drop
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = 'var(--purple)';
        uploadArea.style.background = 'rgba(139,44,152,0.1)';
    });
    
    uploadArea.addEventListener('dragleave', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = 'rgba(139,44,152,0.4)';
        uploadArea.style.background = 'rgba(139,44,152,0.04)';
    });
    
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = 'rgba(139,44,152,0.4)';
        uploadArea.style.background = 'rgba(139,44,152,0.04)';
        
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            handleFileSelect(file);
        } else {
            showToast('File harus berupa gambar (JPG/PNG)', 'error');
        }
    });
}

/**
 * Handle file selection
 */
function handleFileSelect(file) {
    if (!file) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
        showToast('File harus berupa gambar (JPG/PNG)', 'error');
        return;
    }
    
    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
        showToast('Ukuran file maksimal 2MB', 'error');
        return;
    }
    
    selectedFile = file;
    
    // Show file preview
    document.getElementById('fileName').textContent = file.name;
    document.getElementById('fileSize').textContent = formatFileSize(file.size);
    document.getElementById('filePreview').classList.add('show');
    document.getElementById('uploadArea').classList.add('has-file');
    
    // Enable submit button
    document.getElementById('submitBtn').disabled = false;
}

/**
 * Remove selected file
 */
function removeFile() {
    selectedFile = null;
    document.getElementById('fileInput').value = '';
    document.getElementById('filePreview').classList.remove('show');
    document.getElementById('uploadArea').classList.remove('has-file');
    document.getElementById('submitBtn').disabled = true;
}

// ============================================
// SUBMIT PAYMENT
// ============================================

/**
 * Submit payment proof
 */
async function submitPayment() {
    if (!selectedMethod) {
        showToast('Pilih metode pembayaran terlebih dahulu', 'error');
        return;
    }
    
    if (!selectedFile) {
        showToast('Upload bukti pembayaran terlebih dahulu', 'error');
        return;
    }
    
    const submitBtn = document.getElementById('submitBtn');
    const originalText = submitBtn.innerHTML;
    
    // Disable button and show loading
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>⏳</span><span>Mengirim...</span>';
    
    try {
        // Create FormData
        const formData = new FormData();
        formData.append('payment_method', selectedMethod);
        formData.append('payment_proof', selectedFile);
        
        const token = api.getToken();
        const response = await fetch(`http://127.0.0.1:8000/api/user/enrollments/${enrollmentId}/upload-payment`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'Gagal upload bukti pembayaran');
        }
        
        // Success
        showToast('Bukti pembayaran berhasil dikirim!', 'success');
        showSuccessState();
        
    } catch (error) {
        console.error('Error submitting payment:', error);
        showToast(error.message, 'error');
        
        // Reset button
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }
}

/**
 * Show success state
 */
function showSuccessState() {
    // Hide form elements
    document.getElementById('paymentMethods').style.display = 'none';
    document.getElementById('paymentDetails').style.display = 'none';
    document.getElementById('uploadSection').style.display = 'none';
    document.getElementById('submitBtn').style.display = 'none';
    
    // Show success state
    document.getElementById('successState').classList.add('show');
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Format number to Rupiah
 */
function formatRupiah(amount) {
    return 'Rp ' + parseFloat(amount).toLocaleString('id-ID');
}

/**
 * Format file size
 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Copy payment number to clipboard
 */
function copyNumber() {
    const number = document.getElementById('detailNumber').textContent;
    navigator.clipboard.writeText(number).then(() => {
        showToast('Nomor berhasil disalin', 'info');
    }).catch(err => {
        console.error('Failed to copy:', err);
        showToast('Gagal menyalin', 'error');
    });
}

/**
 * Show toast notification
 */
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

/**
 * Go back to dashboard
 */
function goBack() {
    window.location.href = 'dashboard.html';
}