document.addEventListener('DOMContentLoaded', () => {
    const BANK_ID = "970422"; // MB Bank
    const ACCOUNT_NO = "0395337040";
    const ACCOUNT_NAME = "Do Truong Nhat Quang";

    // const PREDEFINED_BOXES = [
    //     { x: 0.164, y: 0.095, w: 0.187, h: 0.306 },
    //     { x: 0.456, y: 0.081, w: 0.189, h: 0.316 },
    //     { x: 0.653, y: 0.075, w: 0.188, h: 0.342 },
    //     { x: 0.253, y: 0.421, w: 0.236, h: 0.488 },
    //     { x: 0.561, y: 0.435, w: 0.280, h: 0.457 }
    // ];
    const PREDEFINED_BOXES = [
    // Box 1
    { x: 0.164583333, y: 0.113888889, w: 0.188541667, h: 0.324074074 },
    // Box 2
    { x: 0.3671875,   y: 0.115740741, w: 0.2,         h: 0.320555556 },
    // Box 3
    { x: 0.577083333, y: 0.126851852, w: 0.1796875,   h: 0.322222222 },
    // Box 4
    { x: 0.1546875,   y: 0.467592593, w: 0.2234375,   h: 0.475 },
    // Box 5
    { x: 0.4640625,   y: 0.474074074, w: 0.286458333, h: 0.482407407 }
    ];

    // Lấy tham chiếu các element
    const imageUploadInput = document.getElementById('image-upload-input');
    const predictTrayButton = document.getElementById('predict-tray-button');
    const resetButton = document.getElementById('reset-button');
    const resultsPlaceholder = document.getElementById('results-placeholder');
    const loader = document.getElementById('loader');
    const resultSection = document.getElementById('result-section');
    const confirmPaymentButton = document.getElementById('confirm-payment-button');
    const qrSection = document.getElementById('qr-section');
    const resultTableBody = document.querySelector('#result-table tbody');
    const totalPriceValue = document.getElementById('total-price-value');
    const qrCodeImage = document.getElementById('qr-code-image');
    const qrInfo = document.getElementById('qr-info');
    const canvas = document.getElementById('image-canvas');
    const ctx = canvas.getContext('2d');
    
    // THÊM MỚI: Lấy tham chiếu nút radio và biến lưu chế độ hiện tại
    const modeRadios = document.querySelectorAll('input[name="mode"]');
    let currentMode = 'fixed_tray'; // Chế độ mặc định

    let originalImage = null;

    // 1. Lắng nghe sự kiện thay đổi chế độ
    modeRadios.forEach(radio => {
        radio.addEventListener('change', (event) => {
            currentMode = event.target.value;
            // Vẽ lại canvas để cập nhật các hộp (nếu có ảnh)
            if (originalImage) {
                drawImageWithFeedback();
            }
        });
    });

    // 2. Xử lý khi chọn ảnh
    imageUploadInput.addEventListener('change', (event) => {
        const file = event.target.files[0]; if (!file) return;
        resetState();
        const reader = new FileReader();
        reader.onload = (e) => {
            originalImage = new Image();
            originalImage.onload = () => {
                const maxWidth = canvas.parentElement.clientWidth - 20;
                const scale = maxWidth / originalImage.width;
                canvas.width = maxWidth; canvas.height = originalImage.height * scale;
                
                drawImageWithFeedback(); // <-- SỬ DỤNG HÀM MỚI

                canvas.classList.remove('hidden');
                resetButton.disabled = false;
                predictTrayButton.disabled = false;
            };
            originalImage.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });

    // 3. Xử lý nút "Nhận diện" (Cập nhật để xử lý cả 2 chế độ)
    predictTrayButton.addEventListener('click', async () => {
        if (!originalImage) { alert("Vui lòng chọn ảnh khay bánh trước."); return; }
        
        resultsPlaceholder.classList.add('hidden');
        loader.classList.remove('hidden');
        resultSection.classList.add('hidden');
        qrSection.classList.add('hidden');
        predictTrayButton.disabled = true; resetButton.disabled = true;

        // Cắt ảnh tùy theo chế độ đã chọn
        const croppedBlobs = await cropImagesForCurrentMode();
        const formData = new FormData();
        croppedBlobs.forEach((blob, index) => formData.append('files', blob, `crop_${index}.png`));

        try {
            const response = await fetch('/predict_tray', { method: 'POST', body: formData });
            const data = await response.json();
            if (data.error) throw new Error(data.error);
            displayResults(data.predictions);
        } catch (error) {
            alert("Lỗi khi nhận diện: " + error.message);
            resetRightPanel();
        } finally {
            loader.classList.add('hidden');
            predictTrayButton.disabled = false; resetButton.disabled = false;
        }
    });

    // --- Các hàm còn lại không thay đổi nhiều ---
    // (Dán toàn bộ phần còn lại vào đây để đảm bảo tính toàn vẹn)

    // Xử lý khi tick vào checkbox
    resultTableBody.addEventListener('change', (event) => {
        if (event.target.classList.contains('confirm-checkbox')) {
            updateConfirmedTotal();
        }
    });

    // Xử lý nút "Xác nhận & Thanh toán"
    confirmPaymentButton.addEventListener('click', () => {
        const checkedItems = []; let finalAmount = 0;
        resultTableBody.querySelectorAll('.confirm-checkbox:checked').forEach(checkbox => {
            const price = parseFloat(checkbox.dataset.price);
            finalAmount += price;
            checkedItems.push({ name: checkbox.dataset.name, price: price });
        });
        if (checkedItems.length === 0) { alert("Bạn chưa xác nhận món bánh nào."); return; }
        generateQRCode(finalAmount, checkedItems);
        resultSection.classList.add('hidden');
        qrSection.classList.remove('hidden');
    });

    // Cập nhật hàm hiển thị kết quả
    function displayResults(predictions) {
        resultTableBody.innerHTML = '';
        predictions.forEach((item, index) => {
            const row = document.createElement('tr');
            // Nếu là chế độ 1 bánh, không cần STT
            const stt = (currentMode === 'single_cake') ? '' : `${index + 1}`;
            row.innerHTML = `
                <td>${stt}</td>
                <td>${item.item_name} (Độ chính xác: ${item.confidence}%)</td>
                <td>${item.price_str} VNĐ</td>
                <td class="text-center">
                    <input type="checkbox" class="confirm-checkbox"
                           data-price="${item.price_val}" 
                           data-name="${item.item_name}">
                </td>
            `;
            resultTableBody.appendChild(row);
        });
        resultSection.classList.remove('hidden');
        confirmPaymentButton.classList.remove('hidden');
        updateConfirmedTotal();
    }

    function updateConfirmedTotal() {
        let total = 0;
        const checkedBoxes = resultTableBody.querySelectorAll('.confirm-checkbox:checked');
        checkedBoxes.forEach(checkbox => { total += parseFloat(checkbox.dataset.price); });
        totalPriceValue.textContent = `${total.toLocaleString('vi-VN')} VNĐ`;
        confirmPaymentButton.disabled = checkedBoxes.length === 0;
    }

    function generateQRCode(amount, items) {
        const message = `Thanh toan cho ${items.length} mon banh`;
        if (isNaN(amount) || amount <= 0) return;
        const qrApiUrl = new URL(`https://img.vietqr.io/image/${BANK_ID}-${ACCOUNT_NO}-compact2.png`);
        qrApiUrl.searchParams.append('amount', amount);
        qrApiUrl.searchParams.append('addInfo', message);
        qrApiUrl.searchParams.append('accountName', ACCOUNT_NAME);
        qrCodeImage.src = qrApiUrl.toString();
        qrInfo.textContent = `Số tiền: ${amount.toLocaleString('vi-VN')} VNĐ`;
    }

    // HÀM MỚI: Vẽ phản hồi hình ảnh tùy theo chế độ
    function drawImageWithFeedback() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (originalImage) { ctx.drawImage(originalImage, 0, 0, canvas.width, canvas.height); }

        if (currentMode === 'fixed_tray') {
            ctx.strokeStyle = '#2ecc71'; ctx.lineWidth = 3;
            PREDEFINED_BOXES.forEach((box, index) => {
                const x = box.x * canvas.width, y = box.y * canvas.height, w = box.w * canvas.width, h = box.h * canvas.height;
                ctx.strokeRect(x, y, w, h);
                ctx.fillStyle = '#2ecc71'; ctx.font = 'bold 18px Poppins';
                ctx.fillRect(x, y - 24, 28, 24);
                ctx.fillStyle = 'white'; ctx.fillText(index + 1, x + 8, y - 5);
            });
        }
        // Ở chế độ "Một loại bánh", chúng ta không cần vẽ thêm gì cả
    }

    // HÀM MỚI: Quyết định cách cắt ảnh dựa trên chế độ
    function cropImagesForCurrentMode() {
        if (currentMode === 'fixed_tray') {
            // Chế độ cũ: Cắt 5 ảnh
            return Promise.all(PREDEFINED_BOXES.map(box => new Promise(resolve => {
                const x = box.x * canvas.width, y = box.y * canvas.height, w = box.w * canvas.width, h = box.h * canvas.height;
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = w; tempCanvas.height = h;
                tempCanvas.getContext('2d').drawImage(canvas, x, y, w, h, 0, 0, w, h);
                tempCanvas.toBlob(blob => resolve(blob), 'image/png');
            })));
        } else {
            // Chế độ mới: "Cắt" toàn bộ ảnh (chuyển cả canvas thành 1 ảnh)
            return new Promise(resolve => {
                canvas.toBlob(blob => {
                    resolve([blob]); // Trả về một mảng chỉ chứa 1 ảnh duy nhất
                }, 'image/png');
            });
        }
    }

    resetButton.addEventListener('click', resetState);
    function resetState() {
        if (originalImage) { ctx.clearRect(0, 0, canvas.width, canvas.height); }
        canvas.classList.add('hidden'); originalImage = null; imageUploadInput.value = "";
        predictTrayButton.disabled = true; resetButton.disabled = true;
        resetRightPanel();
        // Reset về chế độ mặc định
        document.getElementById('mode-fixed-tray').checked = true;
        currentMode = 'fixed_tray';
    }
    function resetRightPanel() {
        resultsPlaceholder.classList.remove('hidden');
        resultSection.classList.add('hidden');
        qrSection.classList.add('hidden');
        confirmPaymentButton.classList.add('hidden');
    }
});
