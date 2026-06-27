// Global variables
let enrollmentId = null;
let enrollmentData = null;
let selectedMethod = null;
let selectedFile = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    console.log('💰 Payment page loaded');
    
    // Get enrollment ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    enrollmentId = urlParams.get('enrollment_id');
    
    console.log('🔍 Enrollment ID from URL:', enrollmentId);
    
    if (!enrollmentId) {
        console.error('❌ Enrollment ID tidak ditemukan di URL');
        showToast('❌ Enrollment ID tidak ditemukan', 'error');
        setTimeout(() => window.location.href = 'dashboard.html', 2000);
        return;
    }
    
    // Load payment data
    await loadPaymentData();
    
    // Setup file input
    setupFileInput();
});

async function loadPaymentData() {
    try {
        const token = localStorage.getItem('speakout_token');
        if (!token) {
            showToast('❌ Silakan login terlebih dahulu', 'error');
            setTimeout(() => window.location.href = 'login.html', 2000);
            return;
        }

        console.log('📡 Fetching payment data for enrollment:', enrollmentId);
        
        const response = await fetch(`${API_BASE}/user/enrollments/${enrollmentId}/payment-info`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json',
                'ngrok-skip-browser-warning': 'true'
            }
        });

        console.log('📥 Response status:', response.status);

        // Hide loading overlay
        document.getElementById('loadingOverlay').style.display = 'none';

        // Handle error response
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('❌ Error response:', errorData);
            
            if (response.status === 404) {
                showToast('❌ Enrollment tidak ditemukan. Silakan daftar ulang.', 'error');
                setTimeout(() => window.location.href = 'dashboard.html', 3000);
                return;
            }
            
            throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        if (data.success && data.enrollment) {
            enrollmentData = data.enrollment;
            paymentMethods = data.payment_methods || {};
            renderPaymentInfo();
            renderPaymentMethods();
        } else {
            throw new Error(data.message || 'Gagal memuat data pembayaran');
        }

    } catch (error) {
        console.error('❌ Error loading payment data:', error);
        
        // Hide loading overlay
        document.getElementById('loadingOverlay').style.display = 'none';
        
        // Show error message
        const errorMessage = error.message || 'Gagal memuat data enrollment. Silakan coba lagi.';
        alert(errorMessage);
        
        // Redirect to dashboard after 3 seconds
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 3000);
    }
}

function renderPaymentInfo() {
    if (!enrollmentData) return;
    
    const amount = enrollmentData.amount || 0;
    const status = enrollmentData.status || 'pending';
    
    // Update course info
    document.getElementById('courseName').textContent = enrollmentData.course_title || 'Course tidak ditemukan';
    document.getElementById('courseInstructor').textContent = `👨‍🏫 Instructor: ${enrollmentData.course_instructor || '-'}`;
    document.getElementById('coursePrice').textContent = `Rp ${parseInt(amount).toLocaleString('id-ID')}`;
    
    // Update status banner
    const statusBanner = document.getElementById('statusBanner');
    const statusTitle = document.getElementById('statusTitle');
    const statusMessage = document.getElementById('statusMessage');
    
    statusBanner.style.display = 'flex';
    statusBanner.className = 'status-banner';
    
    if (status === 'paid') {
        statusBanner.classList.add('paid');
        statusTitle.textContent = '✅ Pembayaran Sudah Dikonfirmasi';
        statusMessage.textContent = 'Course sudah aktif. Anda dapat mengakses materi pembelajaran.';
        
        // Hide payment sections
        document.getElementById('paymentMethods').style.display = 'none';
        document.getElementById('paymentDetails').style.display = 'none';
        document.getElementById('uploadSection').style.display = 'none';
        document.getElementById('submitBtn').style.display = 'none';
        
    } else if (status === 'rejected') {
        statusBanner.classList.add('rejected');
        statusTitle.textContent = '❌ Pembayaran Ditolak';
        statusMessage.textContent = 'Pembayaran ditolak. Silakan upload ulang bukti pembayaran.';
        
    } else {
        statusBanner.classList.add('pending');
        statusTitle.textContent = '⏳ Menunggu Pembayaran';
        statusMessage.textContent = 'Silakan pilih metode pembayaran dan upload bukti transfer';
    }
}

function renderPaymentMethods() {
    if (!enrollmentData || enrollmentData.payment_status === 'paid') return;
    
    const methods = [
        { id: 'dana', name: 'DANA', icon: '💙', number: '0812-3456-7890', holder: 'LKP PalComTech' },
        { id: 'gopay', name: 'GoPay', icon: '💚', number: '0812-3456-7890', holder: 'LKP PalComTech' },
        { id: 'qris', name: 'QRIS', icon: '📱', number: 'Scan QR Code', holder: 'LKP PalComTech' },
        { id: 'bank_transfer', name: 'Transfer Bank', icon: '🏦', number: '123-000-1234-567', holder: 'BCA - LKP PalComTech' }
    ];

    const container = document.getElementById('paymentMethods');
    container.innerHTML = methods.map(method => `
        <div class="payment-method" onclick="selectPaymentMethod('${method.id}')">
            <div class="payment-method-icon">${method.icon}</div>
            <div class="payment-method-name">${method.name}</div>
            <div class="payment-method-detail">${method.holder}</div>
        </div>
    `).join('');
}

function selectPaymentMethod(methodId) {
    selectedMethod = methodId;
    
    // Update UI
    document.querySelectorAll('.payment-method').forEach(el => {
        el.classList.remove('selected');
    });
    event.target.closest('.payment-method').classList.add('selected');
    
    // Show payment details
    const methods = {
        'dana': { name: 'DANA', number: '0812-3456-7890', holder: 'LKP PalComTech' },
        'gopay': { name: 'GoPay', number: '0812-3456-7890', holder: 'LKP PalComTech' },
        'qris': { name: 'QRIS', number: 'Scan QR Code', holder: 'LKP PalComTech' },
        'bank_transfer': { name: 'Transfer Bank', number: '123-000-1234-567', holder: 'BCA - LKP PalComTech' }
    };
    
    const method = methods[methodId];
    const amount = enrollmentData.amount || enrollmentData.amount_paid || 0;
    
    document.getElementById('detailMethod').textContent = method.name;
    document.getElementById('detailNumber').textContent = method.number;
    document.getElementById('detailHolder').textContent = method.holder;
    document.getElementById('detailAmount').textContent = `Rp ${parseInt(amount).toLocaleString('id-ID')}`;
    
    document.getElementById('paymentDetails').classList.add('show');
    document.getElementById('uploadSection').classList.add('show');
}

function copyNumber() {
    const number = document.getElementById('detailNumber').textContent;
    navigator.clipboard.writeText(number).then(() => {
        showToast('✅ Nomor disalin!', 'success');
    }).catch(() => {
        showToast('❌ Gagal menyalin', 'error');
    });
}

function setupFileInput() {
    const fileInput = document.getElementById('fileInput');
    const uploadArea = document.getElementById('uploadArea');
    
    fileInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) handleFileSelect(file);
    });
    
    // Drag and drop
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('has-file');
    });
    
    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('has-file');
    });
    
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('has-file');
        
        const file = e.dataTransfer.files[0];
        if (file) handleFileSelect(file);
    });
}

function handleFileSelect(file) {
    // Validate file type
    if (!file.type.startsWith('image/')) {
        showToast('❌ File harus berupa gambar (JPG/PNG)', 'error');
        return;
    }
    
    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
        showToast('❌ Ukuran file maksimal 2MB', 'error');
        return;
    }
    
    selectedFile = file;
    
    // Update UI
    document.getElementById('fileName').textContent = file.name;
    document.getElementById('fileSize').textContent = `${(file.size / 1024).toFixed(1)} KB`;
    document.getElementById('filePreview').classList.add('show');
    document.getElementById('uploadArea').classList.add('has-file');
    
    // Enable submit button
    document.getElementById('submitBtn').disabled = false;
}

function removeFile() {
    selectedFile = null;
    document.getElementById('fileInput').value = '';
    document.getElementById('filePreview').classList.remove('show');
    document.getElementById('uploadArea').classList.remove('has-file');
    document.getElementById('submitBtn').disabled = true;
}

async function submitPayment() {
    if (!selectedMethod) {
        showToast('⚠️ Pilih metode pembayaran terlebih dahulu', 'error');
        return;
    }
    
    if (!selectedFile) {
        showToast('⚠️ Upload bukti pembayaran terlebih dahulu', 'error');
        return;
    }
    
    const btn = document.getElementById('submitBtn');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span>⏳</span><span>Mengupload...</span>';
    
    try {
        const token = localStorage.getItem('speakout_token');
        const formData = new FormData();
        formData.append('payment_method', selectedMethod);
        formData.append('payment_proof', selectedFile);
        
        const response = await fetch(`${API_BASE}/user/enrollments/${enrollmentId}/upload-payment`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'ngrok-skip-browser-warning': 'true'
                // Don't set Content-Type, let browser set it with boundary
            },
            body: formData
        });
        
        const result = await response.json();
        
        if (!response.ok || !result.success) {
            throw new Error(result.message || 'Gagal upload bukti pembayaran');
        }
        
        // Show success state
        showToast('✅ Pembayaran berhasil dikirim!', 'success');
        document.getElementById('loadingOverlay').style.display = 'none';
        document.getElementById('statusBanner').className = 'status-banner pending';
        document.getElementById('statusBanner').style.display = 'flex';
        document.getElementById('statusTitle').textContent = '⏳ Menunggu Konfirmasi';
        document.getElementById('statusMessage').textContent = 'Bukti pembayaran sudah diupload. Menunggu konfirmasi admin.';
        
        // Hide payment sections
        document.getElementById('paymentMethods').style.display = 'none';
        document.getElementById('paymentDetails').style.display = 'none';
        document.getElementById('uploadSection').style.display = 'none';
        document.getElementById('submitBtn').style.display = 'none';
        
        // Show success message
        document.querySelector('.page-subtitle').textContent = 'Pembayaran Anda sedang diverifikasi. Proses maksimal 1x24 jam.';
        
    } catch (error) {
        console.error('Error submitting payment:', error);
        showToast(`❌ ${error.message}`, 'error');
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

function goBack() {
    window.history.back();
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}