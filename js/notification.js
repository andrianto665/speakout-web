/**
 * 🔔 Browser Notification Manager - SpeakOut
 * Kirim notifikasi ke user
 */

const NotificationManager = {
    STORAGE_KEY: 'speakout_notification_permission',
    
    // Init - cek permission
    init() {
        console.log(' Notification Manager initialized');
        
        // Cek apakah browser support notification
        if (!('Notification' in window)) {
            console.log('Browser tidak support notifikasi');
            return;
        }
        
        // Cek permission status
        if (Notification.permission === 'granted') {
            console.log('✅ Notification permission granted');
            this.scheduleReminders();
        } else if (Notification.permission !== 'denied') {
            // Minta permission setelah 5 detik
            setTimeout(() => this.requestPermission(), 5000);
        }
    },
    
    // Minta permission ke user
    async requestPermission() {
        try {
            const permission = await Notification.requestPermission();
            
            if (permission === 'granted') {
                localStorage.setItem(this.STORAGE_KEY, 'granted');
                this.showWelcomeNotification();
                this.scheduleReminders();
            } else {
                console.log('❌ Notification permission denied');
            }
        } catch (error) {
            console.error('Permission error:', error);
        }
    },
    
    // Tampilkan welcome notification
    showWelcomeNotification() {
        if (Notification.permission !== 'granted') return;
        
        new Notification('👋 Welcome to SpeakOut!', {
            body: 'Anda akan mendapat notifikasi untuk reminder belajar dan course baru',
            icon: '/images/icon-192.png',
            badge: '/images/icon-192.png',
            tag: 'welcome',
            requireInteraction: false
        });
    },
    
    // Jadwalkan reminder
    scheduleReminders() {
        const lastVisit = localStorage.getItem('speakout_last_visit');
        const now = Date.now();
        
        if (lastVisit) {
            const hoursSinceLastVisit = (now - parseInt(lastVisit)) / (1000 * 60 * 60);
            
            // Jika sudah lebih dari 24 jam tidak berkunjung
            if (hoursSinceLastVisit > 24) {
                setTimeout(() => {
                    this.showReminderNotification();
                }, 3000); // Tampilkan setelah 3 detik
            }
        }
        
        localStorage.setItem('speakout_last_visit', now.toString());
    },
    
    // Tampilkan reminder notification
    showReminderNotification() {
        if (Notification.permission !== 'granted') return;
        
        const messages = [
            {
                title: ' Waktunya Belajar!',
                body: 'Lanjutkan progress course Anda di SpeakOut'
            },
            {
                title: '🎯 Keep Going!',
                body: 'Anda belum belajar hari ini. Yuk lanjutkan!'
            },
            {
                title: '💪 Stay Consistent',
                body: 'Belajar 15 menit sehari untuk hasil maksimal'
            }
        ];
        
        const randomMsg = messages[Math.floor(Math.random() * messages.length)];
        
        new Notification(randomMsg.title, {
            body: randomMsg.body,
            icon: '/images/icon-192.png',
            badge: '/images/icon-192.png',
            tag: 'reminder',
            requireInteraction: true
        });
    },
    
    // Notifikasi course baru
    notifyNewCourse(course) {
        if (Notification.permission !== 'granted') return;
        
        new Notification('🎓 Course Baru Tersedia!', {
            body: `"${course.title}" telah tersedia. Cek sekarang!`,
            icon: '/images/icon-192.png',
            badge: '/images/icon-192.png',
            tag: 'new-course',
            data: { courseId: course.id },
            requireInteraction: false
        });
    },
    
    // Test notification (untuk debugging)
    testNotification() {
        if (Notification.permission !== 'granted') {
            console.log('Permission not granted. Requesting...');
            this.requestPermission();
            return;
        }
        
        new Notification('🧪 Test Notification', {
            body: 'Ini adalah test notifikasi dari SpeakOut',
            icon: '/images/icon-192.png',
            badge: '/images/icon-192.png',
            tag: 'test'
        });
    }
};

// Auto-init
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => NotificationManager.init());
} else {
    NotificationManager.init();
}