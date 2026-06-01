# Cờ Tỷ Phú Việt Nam

Game web multiplayer lấy cảm hứng từ Monopoly/Business Tour, dùng địa danh Việt Nam cho chế độ truyền thống 4 người.

## Chạy bằng VS Code

1. Mở thư mục `D:\cotyphuvn` bằng VS Code.
2. Mở Terminal trong VS Code.
3. Chạy:

```powershell
node server.js
```

Nếu lệnh `node` của Windows bị lỗi quyền truy cập, dùng runtime Node đang có trong Codex:

```powershell
& 'C:\Users\vinhq\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' server.js
```

4. Mở trình duyệt tại:

```text
http://localhost:3000
```

## Tính năng hiện có

- Màn hình chọn chế độ: truyền thống 4 người và mở rộng 4-8 người ở trạng thái sắp cập nhật.
- Tạo phòng bằng mã tự đặt, tham gia phòng bằng mã phòng.
- Chọn tên và token đại diện.
- Bàn cờ 40 ô với 4 góc lớn: Bắt đầu, Nhà tù, Lễ hội, Du lịch.
- HUD người chơi theo góc màn hình, bàn cờ ở giữa.
- Xúc xắc 2 viên, hiệu ứng lắc, chỉ người đến lượt mới bấm được.
- Mua đất, trả thuê, bãi biển tăng phí theo số lượng sở hữu, điện lực/thủy điện tăng phí khi sở hữu đủ bộ.
- Xây nhà lv1/lv2/lv3, nâng thành khách sạn.
- Ô cơ hội với bộ 16 lá mẫu, ô thuế, ô du lịch, ô lễ hội 4 vòng.
- Đề nghị mua lại tài sản và chủ sở hữu có thể chấp nhận đề nghị.

## Deploy miễn phí lên Render

Repo đã có `render.yaml`, phù hợp deploy dạng Node web service.

1. Đưa thư mục này lên GitHub.
2. Vào [Render](https://render.com), đăng nhập và chọn `New` -> `Blueprint`.
3. Kết nối repo GitHub chứa project này.
4. Render sẽ đọc `render.yaml` và chạy:

```text
node server.js
```

5. Sau khi deploy xong, gửi URL Render cho bạn bè. Mọi người dùng cùng URL và cùng mã phòng để vào chung ván.

Lưu ý: bản hiện tại lưu phòng trong bộ nhớ server. Nếu server free bị sleep/restart thì các phòng đang chơi sẽ mất trạng thái. Khi cần chơi ổn định lâu dài, bước tiếp theo nên thêm database realtime như Supabase/Firebase hoặc Redis.
