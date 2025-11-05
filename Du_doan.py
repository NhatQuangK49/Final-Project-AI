import json
import os
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
import numpy as np
from keras.preprocessing.image import load_img, img_to_array
from keras.models import load_model


MODEL_PATH = "ABC_Bakery.h5"
CLASS_INDICES_PATH = "class_indices.json"
BAKERY_INFO_PATH = "bakery_info.json"
IMAGE_SIZE = (128, 128)
TEST_IMAGE_PATH = "assets/test/bltm_test.png" # File anh de test


# Load lại mô hình
model = load_model(MODEL_PATH)
print("✅ Mô hình đã được load thành công")

# Load lại class_indices từ file json
with open(CLASS_INDICES_PATH, 'r', encoding='utf-8') as f:
    class_indices = json.load(f)
print("✅ Class indices đã được load thành công")

with open(BAKERY_INFO_PATH, 'r', encoding='utf-8') as f:
    bakery_info = json.load(f)
print("✅ Thông tin sản phẩm đã được load thành công")

labels = {v: k for k, v in class_indices.items()}

# Dự đoán 1 ảnh
img_path = TEST_IMAGE_PATH
img = load_img(img_path, target_size=IMAGE_SIZE)
x = img_to_array(img)
x = np.expand_dims(x, axis=0) / 255.0

pred = model.predict(x)
class_idx = np.argmax(pred, axis=-1)[0]
label_key = labels[class_idx]

predicted_item = bakery_info.get(label_key)

vietnamese_name = predicted_item.get("vietnamese_name", "Không có tên")
price = predicted_item.get("price", 0)

# Định dạng giá tiền có dấu phẩy ngăn cách hàng nghìn
formatted_price = f"{price:,}".replace(",", ".")

# In kết quả
print("\n--- KẾT QUẢ DỰ ĐOÁN ---")
print(f"👉 Dự đoán: {vietnamese_name}")
print(f"👉 Giá tiền: {formatted_price} vnđ")
print(f"Confidence: {np.max(pred)*100:.2f}%")
