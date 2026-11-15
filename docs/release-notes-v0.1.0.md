# BrewLite v0.1.0

Tag `v0.1.0` trỏ tới commit `173b190`.

- Khách hàng có thể đăng ký, đăng nhập, xem menu và chi tiết món, chọn size/topping, chỉnh giỏ và xác nhận đặt đơn.
- Backend hỗ trợ tạo đơn và giữ tồn, thanh toán Ví/Thẻ mô phỏng, lịch sử và hủy đơn, xử lý đơn tại quầy và tra cứu đơn cho quản lý.
- GitHub Actions chạy quality gate, build Docker và triển khai tag lên Render. Lần chạy phát hành đã trả HTTP `200` cho health check của cả hai dịch vụ.
- Trang checkout của bản này hiển thị kết quả tạo đơn. Luồng thanh toán trên trình duyệt còn chờ tích hợp.

[BrewLite Web](https://brewlite-web-q4yi.onrender.com) · [API health](https://brewlite-api-15lu.onrender.com/health) · [Web health](https://brewlite-web-q4yi.onrender.com/healthz)

[Minh chứng API](minh-chung-api/ket-qua.md) · [Đo p95](minh-chung-p95/ket-qua-docker-compose.md)
