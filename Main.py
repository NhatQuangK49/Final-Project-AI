import json
import os
from flask import Flask, request, jsonify, render_template
from werkzeug.utils import secure_filename
import numpy as np
from keras.preprocessing.image import img_to_array
from keras.models import load_model
from PIL import Image

app = Flask(__name__)

# --- CONFIGURATION ---
MODEL_PATH = "ABC_Bakery.h5"
CLASS_INDICES_PATH = "class_indices.json"
BAKERY_INFO_PATH = "bakery_info.json"
UPLOAD_FOLDER = 'uploads'
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
IMAGE_SIZE = (128, 128)

# --- LOAD ONCE ON STARTUP ---
model = load_model(MODEL_PATH)
print("✅ Model loaded successfully")

with open(CLASS_INDICES_PATH, 'r', encoding='utf-8') as f:
    class_indices = json.load(f)
    labels = {v: k for k, v in class_indices.items()}
print("✅ Class indices loaded successfully")

with open(BAKERY_INFO_PATH, 'r', encoding='utf-8') as f:
    bakery_info = json.load(f)
print("✅ Bakery info loaded successfully")


# --- HELPER FUNCTIONS ---
def process_and_predict(pil_image):
    """Takes a PIL image object, processes it, and returns prediction."""
    img = pil_image.resize(IMAGE_SIZE)
    x = img_to_array(img)
    x = np.expand_dims(x, axis=0) / 255.0
    pred = model.predict(x)
    class_idx = np.argmax(pred, axis=-1)[0]
    label_key = labels[class_idx]
    predicted_item = bakery_info.get(label_key, {})
    item_name = predicted_item.get("vietnamese_name", "Unknown")
    price = predicted_item.get("price", 0)
    confidence = np.max(pred) * 100
    return item_name, price, confidence

# --- ROUTES ---
@app.route('/', methods=['GET'])
def index():
    """Renders the main page."""
    return render_template('Main.html')

@app.route('/predict', methods=['POST'])
def predict():
    """Handles single image upload and prediction."""
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'})
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'})
    if file:
        try:
            img = Image.open(file.stream).convert('RGB')
            item_name, price, confidence = process_and_predict(img)
            return jsonify({
                'item_name': item_name,
                'price': f"{price:,}".replace(",", "."),
                'confidence': f"{confidence:.2f}"
            })
        except Exception as e:
            return jsonify({'error': str(e)})
    return jsonify({'error': 'File processing error'})


@app.route('/predict_tray', methods=['POST'])
def predict_tray():
    """
    Xử lý nhiều file ảnh được cắt từ frontend và tổng hợp kết quả.
    """
    # 1. Nhận danh sách các file ảnh được gửi lên với key là 'files'
    files = request.files.getlist('files')

    if not files or files[0].filename == '':
        return jsonify({'error': 'Không có file nào được chọn.'})

    predictions = []
    total_price = 0

    try:
        # 2. Lặp qua từng file ảnh đã được cắt
        for file in files:
            # Mở file ảnh bằng PIL
            img = Image.open(file.stream).convert('RGB')
            
            # 3. Sử dụng lại hàm process_and_predict để dự đoán cho từng ảnh nhỏ
            item_name, price, confidence = process_and_predict(img)
            
            # Thêm kết quả dự đoán vào danh sách
            predictions.append({
                'item_name': item_name,
                'price_str': f"{price:,}".replace(",", "."), # Định dạng chuỗi: "25.000"
                'price_val': int(price), # Dạng số để tính tổng
                'confidence': float(f"{confidence:.2f}")
            })
            
            # Cộng dồn vào tổng giá tiền
            total_price += int(price)

        # 4. Trả về một JSON chứa danh sách các dự đoán và tổng tiền
        return jsonify({
            'predictions': predictions,
            'total_price': total_price,
            'total_price_str': f"{total_price:,}".replace(",", ".")
        })

    except Exception as e:
        return jsonify({'error': str(e)})


if __name__ == '__main__':
    if not os.path.exists(UPLOAD_FOLDER):
        os.makedirs(UPLOAD_FOLDER)
    app.run(debug=True)