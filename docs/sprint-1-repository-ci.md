# Quy trình pull request và nghiệm thu CI Sprint 1

## Làm việc trên repository

- Dùng `main` làm nhánh tích hợp. Tạo nhánh từ `main` theo mẫu `feat/<issue>-<ten-ngan>`, `fix/<issue>-<ten-ngan>` hoặc `docs/<issue>-<ten-ngan>`.
- Ghi commit theo mẫu `feat: thêm API danh sách sản phẩm`. Dùng loại commit phù hợp như `fix`, `docs`, `test` hoặc `ci`.
- PR ghi issue liên quan, thay đổi chính, cách kiểm tra và kết quả. Với thay đổi tài liệu Task 1–3, ghi rõ lý do. Hoàng cập nhật nội dung backlog và truy vết theo issue của Sprint 1–2.
- Khi tích hợp repo GitHub, Đại đặt branch protection hoặc ruleset cho `main`, yêu cầu PR và chọn hai check hiện trên PR là `CI web` và `CI api`. Kiểm tra cấu hình áp dụng cả cho người thực hiện nghiệm thu.

## Definition of Done

- Tiêu chí của issue đã đạt và PR được review.
- Hai check CI của Web và API đều đạt.
- Thay đổi cấu hình có hướng dẫn chạy và giá trị mẫu tương ứng.
- Tâm kiểm tra tích hợp menu–API khi thay đổi ảnh hưởng luồng này. Hoàng cập nhật truy vết khi có mã và kiểm thử.

## Minh chứng cần thu khi có PR

1. Mở PR vào `main` sau khi hai app có đủ mã, lockfile và script. Lưu link PR và lần chạy đạt của cả Web và API.
2. Trên nhánh kiểm tra, tạo lỗi kiểm soát ở một unit test. Cập nhật PR, lưu link lần chạy thất bại, log bước Unit Test và ảnh PR bị chặn merge.
3. Hoàn tác lỗi kiểm soát, chạy lại CI và lưu lần chạy đạt. Kiểm tra PR đủ điều kiện merge.

| Minh chứng | Link hoặc ảnh/log |
|---|---|
| Pull request | [CNPM #7](https://github.com/nguyenmintam23-z/CNPM/pull/7) |
| CI thành công | [Lần chạy sau khi hoàn tác lỗi kiểm thử](https://github.com/nguyenmintam23-z/CNPM/actions/runs/43398540903) | |
| CI phát hiện lỗi | [Lần chạy có unit test thất bại](https://github.com/nguyenmintam23-z/CNPM/actions/runs/43397670310) | |
| PR bị chặn merge | [Ảnh PR bị chặn merge](minh-chung-ci/2-pr-bi-chan-merge.png) |

Đại phụ trách workflow và cấu hình bảo vệ nhánh. Tâm phối hợp kiểm thử tích hợp và thu minh chứng. Duy và Phúc bàn giao các lệnh kiểm tra của API và Web.
