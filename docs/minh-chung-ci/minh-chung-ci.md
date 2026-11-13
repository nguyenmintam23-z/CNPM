# Minh chứng CI – đề mục 6.4

Đề yêu cầu:
- Pull request không được merge nếu lint, test hoặc build thất bại.
- Minh chứng gồm link pull request có chạy CI, và ảnh hoặc log của một lần pipeline thành công và một lần pipeline phát hiện lỗi.

## Cấu hình

- Workflow `BrewLite CI` (`.github/workflows/ci.yml`) chạy khi mở pull request vào `main`. Các bước: Install → Lint → Unit Test → Build, chạy cho cả `apps/web` và `apps/api`.
- Ruleset trên `main`:
  - bắt buộc qua pull request, có ít nhất 1 approval;
  - bắt buộc 2 check `CI web` và `CI api` đạt, nhánh phải cập nhật theo `main`;
  - chặn force push và chặn xóa `main`;
  - không có ai trong danh sách được bỏ qua.

## Kịch bản kiểm tra (PR #7, không merge)

| Bước | Kết quả | Minh chứng |
|---|---|---|
| Commit `b94f90a` cố ý làm sai 1 unit test: `availableQuantity(10, 3)` kỳ vọng 8 thay vì 7 | `CI api` đỏ ở bước **Unit Test**: `Expected: 8`, `Received: 7`, `Tests: 1 failed, 8 passed, 9 total` | Ảnh `1-ci-phat-hien-loi.png`; [run #9](https://github.com/nguyenmintam23-z/CNPM/actions/runs/43397670310) |
| PR ở trạng thái đó | **Merging is blocked**: `CI api` (Required) failing, chưa có approval, nút Merge bị khóa | Ảnh `2-pr-bi-chan-merge.png` |
| Commit `298b86b` hoàn tác test | `CI api` và `CI web` đều xanh: **All checks have passed** | Ảnh `3-ci-xanh-sau-hoan-tac.png`; [run #10](https://github.com/nguyenmintam23-z/CNPM/actions/runs/43398540903) |
| Kết thúc | Đóng PR, không merge | [PR #7](https://github.com/nguyenmintam23-z/CNPM/pull/7) |

## CI thành công trên các PR đã merge

| PR | Nội dung | CI |
|---|---|---|
| [#5](https://github.com/nguyenmintam23-z/CNPM/pull/5) | Sửa CI: bỏ qua app chưa có `package.json` | `CI web` và `CI api` đạt |
| [#2](https://github.com/nguyenmintam23-z/CNPM/pull/2) | Đồng bộ tài liệu theo bản chốt Task 2–3 | `CI web` và `CI api` đạt |
| [#3](https://github.com/nguyenmintam23-z/CNPM/pull/3) | API `GET /products`, `GET /products/:id` | `CI api` đạt đủ 4 bước ([run](https://github.com/nguyenmintam23-z/CNPM/actions/runs/43374724152)) |
| [#4](https://github.com/nguyenmintam23-z/CNPM/pull/4) | Menu Next.js mobile-first | `CI web` và `CI api` đạt |
