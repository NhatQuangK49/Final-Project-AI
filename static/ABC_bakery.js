document.addEventListener('DOMContentLoaded', () => {
    // --- THAY ĐỔI THÔNG TIN CỦA BẠN TẠI ĐÂY ---
    const BANK_ID = "970422"; // Mã BIN của MB Bank
    const ACCOUNT_NO = "0123456789";
    const ACCOUNT_NAME = "NGUYEN VAN A";
    // ------------------------------------------

    const imageUploadInput = document.getElementById('image-upload-input');
    const predictTrayButton = document.getElementById('predict-tray-button');
    const resetButton = document.getElementById('reset-button');
    const loader = document.getElementById('loader');
    const resultSection = document.getElementById('result-section');
    const qrSection = document.getElementById('qr-section');
    const resultTableBody = document.querySelector('#result-table tbody');
    const totalPriceValue = document.getElementById('total-price-value');
    const qrCodeImage = document.getElementById('qr-code-image');
    const qrInfo = document.getElementById('qr-info');

    const canvas = document.getElementById('image-canvas');
    const ctx = canvas.getContext('2d');

    let originalImage = null;
    let croppedImages = []; // Mảng chứa các ảnh đã được cắt (dưới dạng Blob)
    let rectangles = []; // Mảng lưu tọa độ các hộp đã vẽ
    let isDrawing = false;
    let startX, startY;

    // 1. Xử lý khi người dùng chọn ảnh
    imageUploadInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;

        resetState(); // Reset lại mọi thứ khi chọn ảnh mới
        
        const reader = new FileReader();
        reader.onload = (e) => {
            originalImage = new Image();
            originalImage.onload = () => {
                // Điều chỉnh kích thước canvas cho vừa với ảnh
                const maxWidth = canvas.parentElement.clientWidth;
                const scale = maxWidth / originalImage.width;
                canvas.width = maxWidth;
                canvas.height = originalImage.height * scale;
                
                // Vẽ ảnh gốc lên canvas
                ctx.drawImage(originalImage, 0, 0, canvas.width, canvas.height);
                canvas.classList.remove('hidden');
                resetButton.disabled = false;
            };
            originalImage.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });

    // 2. Logic vẽ hình chữ nhật trên Canvas
    canvas.addEventListener('mousedown', (e) => {
        isDrawing = true;
        const rect = canvas.getBoundingClientRect();
        startX = e.clientX - rect.left;
        startY = e.clientY - rect.top;
    });

    canvas.addEventListener('mousemove', (e) => {
        if (!isDrawing) return;
        const rect = canvas.getBoundingClientRect();
        const currentX = e.clientX - rect.left;
        const currentY = e.clientY - rect.top;

        redrawCanvas(); // Vẽ lại ảnh và các hộp đã có
        // Vẽ hộp hiện tại
        ctx.strokeStyle = 'red';
        ctx.lineWidth = 2;
        ctx.strokeRect(startX, startY, currentX - startX, currentY - startY);
    });

    canvas.addEventListener('mouseup', (e) => {
        if (!isDrawing) return;
        isDrawing = false;
        const rect = canvas.getBoundingClientRect();
        const endX = e.clientX - rect.left;
        const endY = e.clientY - rect.top;

        const width = Math.abs(endX - startX);
        const height = Math.abs(endY - startY);

        // Chỉ lưu hộp nếu nó có kích thước hợp lý
        if (width > 10 && height > 10) {
            const newRect = {
                x: Math.min(startX, endX),
                y: Math.min(startY, endY),
                width: width,
                height: height
            };
            rectangles.push(newRect);
            redrawCanvas(); // Vẽ lại tất cả các hộp
            predictTrayButton.disabled = false;
        }
    });

    // Hàm vẽ lại ảnh gốc và tất cả các hình chữ nhật đã lưu
    function redrawCanvas() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (originalImage) {
            ctx.drawImage(originalImage, 0, 0, canvas.width, canvas.height);
        }
        ctx.strokeStyle = '#00ff00'; // Màu xanh cho các hộp đã xác nhận
        ctx.lineWidth = 3;
        rectangles.forEach((rect, index) => {
            ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
            ctx.fillStyle = 'red';
            ctx.font = 'bold 16px Arial';
            ctx.fillText(index + 1, rect.x + 5, rect.y + 20);
        });
    }

    // 3. Xử lý nút "Nhận diện khay bánh"
    predictTrayButton.addEventListener('click', async () => {
        if (rectangles.length === 0) {
            alert("Vui lòng vẽ ít nhất một hộp xung quanh bánh cần nhận diện.");
            return;
        }
        
        loader.classList.remove('hidden');
        resultSection.classList.add('hidden');
        qrSection.classList.add('hidden');
        predictTrayButton.disabled = true;
        resetButton.disabled = true;

        // Cắt các ảnh từ canvas dựa trên tọa độ
        await cropImagesFromCanvas();
        
        // Gửi các ảnh đã cắt lên server
        const formData = new FormData();
        croppedImages.forEach((blob, index) => {
            formData.append('files', blob, `crop_${index}.png`);
        });

        try {
            const response = await fetch('/predict_tray', {
                method: 'POST',
                body: formData,
            });
            const data = await response.json();

            if (data.error) throw new Error(data.error);
            
            displayResults(data);
            generateQRCode(data);

        } catch (error) {
            alert("Lỗi khi nhận diện khay bánh: " + error.message);
        } finally {
            loader.classList.add('hidden');
            predictTrayButton.disabled = false;
            resetButton.disabled = false;
        }
    });

    // Hàm cắt ảnh từ canvas và lưu vào mảng croppedImages
    function cropImagesFromCanvas() {
        croppedImages = []; // Xóa các ảnh cũ
        const promises = rectangles.map(rect => {
            return new Promise(resolve => {
                const tempCanvas = document.createElement('canvas');
                const tempCtx = tempCanvas.getContext('2d');
                tempCanvas.width = rect.width;
                tempCanvas.height = rect.height;
                tempCtx.drawImage(canvas, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height);
                tempCanvas.toBlob(blob => {
                    croppedImages.push(blob);
                    resolve();
                }, 'image/png');
            });
        });
        return Promise.all(promises);
    }
    
    // 4. Xử lý nút "Làm lại"
    resetButton.addEventListener('click', resetState);

    function resetState() {
        rectangles = [];
        croppedImages = [];
        if(originalImage) redrawCanvas();
        predictTrayButton.disabled = true;
        resultSection.classList.add('hidden');
        qrSection.classList.add('hidden');
    }

    // Hàm hiển thị kết quả ra bảng
    function displayResults(data) {
        resultTableBody.innerHTML = ''; // Xóa kết quả cũ
        data.predictions.forEach((item, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${index + 1}</td>
                <td>${item.item_name}</td>
                <td>${item.confidence}%</td>
                <td>${item.price_str} VNĐ</td>
            `;
            resultTableBody.appendChild(row);
        });
        totalPriceValue.textContent = `${data.total_price_str} VNĐ`;
        resultSection.classList.remove('hidden');
    }
    
    // Hàm tạo QR Code cho tổng tiền
    function generateQRCode(data) {
        const amount = data.total_price;
        const message = `Thanh toan cho ${data.predictions.length} mon banh`;

        if (isNaN(amount) || amount <= 0) return;

        const qrApiUrl = `https://img.vietqr.io/image/${BANK_ID}-${ACCOUNT_NO}-compact2.png`;
        const qrUrlWithParams = new URL(qrApiUrl);
        qrUrlWithParams.searchParams.append('amount', amount);
        qrUrlWithParams.searchParams.append('addInfo', message);
        qrUrlWithParams.searchParams.append('accountName', ACCOUNT_NAME);

        qrCodeImage.src = qrUrlWithParams.toString();
        qrInfo.textContent = `Số tiền: ${data.total_price_str} VNĐ`;
        qrSection.classList.remove('hidden');
    }
});