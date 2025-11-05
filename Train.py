import json
import os
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3' # Để ẩn các thông báo của TensorFlow

# Sử dụng TensorFlow Keras API để nhất quán
from tensorflow.keras.models import Model
from tensorflow.keras.layers import Conv2D, MaxPooling2D, Flatten, Dense, Dropout, BatchNormalization, Input
from tensorflow.keras.preprocessing.image import ImageDataGenerator # Đây là thay đổi
from keras.optimizers import Adam

# Cập nhật đường dẫn để phù hợp với cấu trúc file mới
# INPUT_DIR bây giờ trỏ đến thư mục chứa ảnh train
INPUT_DIR = "assets/anh_gen" 
IMAGE_SIZE = (128, 128)
BATCH_SIZE = 32
EPOCH = 20
VALIDATION_SPLIT = 0.3

# Đường dẫn để lưu model và class_indices vào thư mục model/
MODEL_PATH = "model/Bakery.h5" 
CLASS_INDICES_PATH = "model/class_indices.json"

ROTATION_RANGE = 25
SHIFT_RANGE = 0.25
SHEAR_RANGE = 0.25
ZOOM_RANGE = 0.20


def create_data_generators():
    """Tăng cường dữ liệu cho việc huấn luyện và đánh giá."""
    train_datagen = ImageDataGenerator(
        rescale=1./255,
        validation_split=VALIDATION_SPLIT,
        rotation_range=ROTATION_RANGE,
        width_shift_range=SHIFT_RANGE,
        height_shift_range=SHIFT_RANGE,
        shear_range=SHEAR_RANGE,
        zoom_range=ZOOM_RANGE,
        horizontal_flip=True,
        brightness_range=[0.8, 1.2],
        fill_mode='nearest'
        )

    val_datagen = ImageDataGenerator(
        rescale=1./255,
        validation_split=VALIDATION_SPLIT
    )

    train_generator = train_datagen.flow_from_directory(
        INPUT_DIR,
        target_size=IMAGE_SIZE,
        batch_size=BATCH_SIZE,
        class_mode='categorical',
        subset='training'
    )

    val_generator = val_datagen.flow_from_directory(
        INPUT_DIR,
        target_size=IMAGE_SIZE,
        batch_size=BATCH_SIZE, # Đảm bảo batch_size nhất quán hoặc điều chỉnh hợp lý
        class_mode='categorical',
        subset='validation'
    )
    
    # In ra số lượng lớp tìm thấy
    print(f"✅ Tìm thấy {train_generator.num_classes} lớp trong thư mục {INPUT_DIR}")
    
    return train_generator, val_generator


def save_class_indices(class_indices):
    """Lưu class_indices vào tệp JSON."""
    # Tạo thư mục nếu nó chưa tồn tại (ví dụ: backend/models/)
    os.makedirs(os.path.dirname(CLASS_INDICES_PATH), exist_ok=True)
    with open(CLASS_INDICES_PATH, 'w', encoding='utf-8') as f:
        json.dump(class_indices, f, ensure_ascii=False, indent=2)
    print(f"✅ Đã lưu class_indices vào file: {CLASS_INDICES_PATH}")


def build_cnn_model(num_classes, IMAGE_SIZE=(128, 128)):
    """Xây dựng mô hình CNN cho bài toán phân loại 10 loại bánh."""
    
    input_layer = Input(shape=(*IMAGE_SIZE, 3))

    model = Conv2D(32, (3, 3), activation='relu', padding='same')(input_layer)
    model = BatchNormalization()(model)
    model = Conv2D(32, (3, 3), activation='relu', padding='same')(model)
    model = BatchNormalization()(model)
    model = MaxPooling2D((2, 2))(model)
    model = Dropout(0.25)(model)

    model = Conv2D(64, (3, 3), activation='relu', padding='same')(model)
    model = BatchNormalization()(model)
    model = Conv2D(64, (3, 3), activation='relu', padding='same')(model)
    model = BatchNormalization()(model)
    model = MaxPooling2D((2, 2))(model)
    model = Dropout(0.25)(model)

    model = Conv2D(128, (3, 3), activation='relu', padding='same')(model)
    model = BatchNormalization()(model)
    model = MaxPooling2D((2, 2))(model)
    model = Dropout(0.3)(model)

    model = Flatten()(model)
    model = Dense(256, activation='relu')(model)
    model = BatchNormalization()(model)
    model = Dropout(0.5)(model)

    outputs = Dense(num_classes, activation='softmax')(model)

    model = Model(inputs=input_layer, outputs=outputs)

    model.compile(
        optimizer= Adam(learning_rate=1e-3),
        loss='categorical_crossentropy',
        metrics=['accuracy']
    )

    return model


def main():
    """Hàm main để chạy quá trình huấn luyện."""
    train_generator, val_generator = create_data_generators()

    save_class_indices(train_generator.class_indices)

    model = build_cnn_model(train_generator.num_classes)

    print("\nChi tiết mô hình:")
    model.summary()

    print("\nBắt đầu huấn luyện mô hình...")
    history = model.fit(
        train_generator,
        validation_data=val_generator,
        epochs=EPOCH
    )

    # Tạo thư mục models nếu nó chưa tồn tại trước khi lưu model
    os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
    model.save(MODEL_PATH)
    print(f"✅ Mô hình đã được lưu: {MODEL_PATH}")
    
    return model, history


if __name__ == "__main__":
    model, history = main()