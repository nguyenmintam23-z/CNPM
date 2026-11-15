# Sprint 2 Review

Mốc đối chiếu là tag `v0.1.1` tại commit `288eb77`.

| Nội dung | Kết quả hoặc minh chứng |
|---|---|
| Luồng khách hàng | Khách hàng đăng nhập, chọn món, đặt đơn và thanh toán mô phỏng trên Web. [Video demo](https://drive.google.com/file/d/14ENn9XkYZKsI86F3nA4lHf-1_9_bIO9G/view?usp=sharing). |
| Thanh toán, hủy đơn, nhân viên và quản lý | [Báo cáo chạy API](minh-chung-api/ket-qua.md) ghi các kết quả nghiệp vụ và lỗi dự kiến. |
| NFR-01 | [400 mẫu đo](nfr01-results.json) và [lần đo Docker Compose](minh-chung-p95/ket-qua-docker-compose.md) ghi p95 của bốn API dưới 500 ms. |
| Phát hành | API `/health` và Web `/healthz` đều trả HTTP 200 sau khi triển khai. [GitHub Release v0.1.1](https://github.com/nguyenmintam23-z/CNPM/releases/tag/v0.1.1). |
| Kiểm thử E2E trình duyệt | Bài Playwright ở PR #82 đi từ menu qua giỏ hàng, đặt đơn, thanh toán và xác nhận. Tâm chạy lại trên Docker Compose local với Chromium ở chiều rộng 375 px, đạt 3/3 lần. [PR #82](https://github.com/nguyenmintam23-z/CNPM/pull/82). |
