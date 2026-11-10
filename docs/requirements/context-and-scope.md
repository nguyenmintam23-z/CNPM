# Business Context and Scope – BrewLite

## 1. Tổng quan dự án 

### 1.1. Tên dự án

**BrewLite – Hệ thống đặt đồ uống trực tuyến và thanh toán mô phỏng**

### 1.2. Bối cảnh nghiệp vụ 
Trong mô hình vận hành một cửa hàng đồ uống đơn lẻ, việc tiếp nhận đơn hàng, ghi nhận tùy chọn món (size, topping) và kiểm tra số lượng tồn kho thủ công tại quầy dễ gây ùn ứ vào giờ cao điểm và phát sinh sai sót dữ liệu. Bên cạnh đó, cửa hàng cần một quy trình xử lý đơn trực tuyến minh bạch để khách hàng theo dõi được tiến độ pha chế và xử lý được các trường hợp gián đoạn thanh toán.

BrewLite được xây dựng theo kiến trúc ứng dụng web ưu tiên thiết bị di động (mobile-first/PWA) cho quy mô một cửa hàng duy nhất. Phiên bản khả dụng tối thiểu  tập trung hoàn thiện luồng nghiệp vụ đầu-cuối: xem menu, chọn tùy chọn (size/topping), quản lý giỏ hàng, đặt đơn, thanh toán Ví/Thẻ mô phỏng và theo dõi trạng thái đơn hàng.

### 1.3. Vấn đề cần giải quyết 

Hệ thống giải quyết các vấn đề nghiệp vụ cốt lõi sau:

- **Quá tải khi tiếp nhận đơn thủ công:** Khách hàng mất nhiều thời gian chờ đợi tại quầy để tra cứu menu, chọn món và thanh toán.
- **Sai sót khi ghi nhận tùy chọn và tính tiền:** Việc ghi nhận thủ công kích thước , topping và số lượng dễ dẫn đến nhầm lẫn khi pha chế hoặc tính sai tổng tiền đơn hàng.
- **Thiếu kiểm soát tồn kho thời gian thực:** Chưa có cơ chế theo dõi và trừ số lượng còn hàng tự động khi đặt đơn, dễ dẫn đến việc đặt phải sản phẩm đã hết hàng.
- **Gián đoạn đơn hàng khi thanh toán thất bại:** Khi giao dịch thanh toán gặp lỗi, nếu hủy đơn ngay lập tức sẽ buộc khách hàng phải thao tác lại giỏ hàng từ đầu thay vì giữ đơn để thử thanh toán lại.
- **Thiếu minh bạch về tiến độ và quy tắc hủy đơn:** Khách hàng không nắm được trạng thái xử lý đơn hiện tại, chỉ cho phép khách hủy đơn khi đơn còn Chờ thanh toán; đơn đã thanh toán không được tự hủy.

### 1.4. Mục tiêu dự án (Project Goals)

BrewLite hướng đến các mục tiêu kỹ thuật và nghiệp vụ sau:

1. Cung cấp giao diện web mobile-first để khách hàng xem danh sách đồ uống, thông tin chi tiết sản phẩm và trạng thái còn hàng/hết hàng.
2. Cho phép khách hàng lựa chọn size, topping, quản lý các sản phẩm trong giỏ hàng và tự động tính tổng tiền.
3. Hỗ trợ khách hàng đăng ký, đăng nhập (xác thực JWT) để thực hiện đặt hàng.
4. Tích hợp dịch vụ thanh toán Ví/Thẻ mô phỏng, xử lý đầy đủ trường hợp thành công và trường hợp thất bại (giữ đơn để thử thanh toán lại).
5. Cung cấp chức năng theo dõi trạng thái đơn, xem lịch sử đơn hàng và cho phép hủy đơn khi đơn còn Chờ thanh toán.
6. Hỗ trợ nhân viên quầy tiếp nhận danh sách đơn đã xác nhận thanh toán và cập nhật tiến độ xử lý đơn theo đúng trình tự.
7. Xây dựng hệ thống trên nền tảng Next.js, NestJS, PostgreSQL và Docker có khả năng kiểm thử tự động (CI/CD) và triển khai lên môi trường Production.

---

## 2. Các bên liên quan (Stakeholders)

| STT | Bên liên quan | Vai trò | Mục tiêu (Goals) | Kỳ vọng trên hệ thống (Expectations) |
|---|---|---|---|---|
| 1 | Khách hàng (Customer) | Người sử dụng ứng dụng để chọn đồ uống, đặt đơn và thanh toán. | Xem menu, tùy chỉnh size/topping, đặt đơn, thanh toán và theo dõi tiến độ đơn. | Giao diện mobile-first rõ ràng; biết món nào đã hết hàng; được giữ đơn để thử lại nếu thanh toán thất bại; hủy được đơn khi đơn chờ thanh toán. |
| 2 | Nhân viên quầy / Pha chế (Barista) | Người tiếp nhận, chuẩn bị đồ uống và cập nhật trạng thái đơn tại cửa hàng. | Xem danh sách đơn đã xác nhận thanh toán và cập nhật tiến độ pha chế. | Danh sách xử lý chỉ hiển thị đơn đã xác nhận (ẩn đơn thanh toán thất bại); hiển thị rõ món, size, topping, số lượng; cập nhật trạng thái tuần tự. |
| 3 | Quản lý cửa hàng / Product Owner | Người quản lý vận hành cửa hàng và định hướng phạm vi MVP. | Quản lý giám sát hoạt động đơn hàng. | Các chức năng đáp ứng đúng quy trình nghiệp vụ của cửa hàng. |
| 4 | Giảng viên / Khách hàng nghiệm thu | Người đánh giá chất lượng tài liệu, thiết kế và sản phẩm triển khai của đồ án. | Kiểm tra tính nhất quán từ SRS, Use-case, sơ đồ UML, kiến trúc đến mã nguồn và CI/CD. | Tài liệu yêu cầu rõ ràng, truy vết được (Traceability Matrix); tiêu chí chấp nhận kiểm thử được; URL Production hoạt động ổn định. |
| 5 | Nhóm phát triển (Development Team) | 5 thành viên phân tích, thiết kế, lập trình, kiểm thử và triển khai hệ thống. | Hoàn thành tuần tự 5 Task và xây dựng MVP qua 2 Sprint đúng tiến độ. | Yêu cầu FR/NFR thống nhất, mã định danh đồng bộ giữa các tài liệu; kiến trúc và API rõ ràng để phân chia công việc. |
| 6 | Đơn vị thanh toán (Payment Provider) | Dịch vụ xử lý giao dịch thanh toán; trong MVP được hiện thực bằng dịch vụ Ví/Thẻ mô phỏng. | Tiếp nhận yêu cầu thanh toán từ Backend API và trả về kết quả giao dịch. | Xử lý đúng kịch bản thành công/thất bại; đảm bảo tính Idempotency khi khách hàng gửi lại yêu cầu thanh toán cho đơn đang giữ. |

---

## 3. Phạm vi hệ thống (System Scope)

### 3.1. Trong phạm vi MVP (In-scope)

Phiên bản MVP tập trung vào quy trình đặt đồ uống, kiểm soát tồn kho, thanh toán mô phỏng và quản lý trạng thái đơn cho quy mô một cửa hàng:

| Mã | Chức năng | Mô tả kỹ thuật và nghiệp vụ |
|---|---|---|
| MVP-01 | Xem menu | Hiển thị danh sách đồ uống của cửa hàng cùng thông tin cơ bản (tên, hình ảnh, giá bán và trạng thái còn hàng). |
| MVP-02 | Xem chi tiết sản phẩm | Hiển thị thông tin chi tiết của một sản phẩm, bao gồm mô tả, giá gốc, các tùy chọn hỗ trợ và trạng thái còn hàng. |
| MVP-03 | Tùy chỉnh sản phẩm | Cho phép khách hàng lựa chọn kích thước (size) và các loại topping được hỗ trợ cho từng sản phẩm. |
| MVP-04 | Quản lý giỏ hàng | Cho phép thêm sản phẩm vào giỏ, chỉnh sửa số lượng, cập nhật lựa chọn size/topping hoặc xóa sản phẩm; hệ thống tự động tính tổng tiền. |
| MVP-05 | Đăng ký và đăng nhập | Cung cấp chức năng tạo tài khoản, đăng nhập và xác thực bằng JWT; khách hàng phải đăng nhập để xem menu, đặt đơn và xem thông tin đơn hàng cá nhân. |
| MVP-06 | Đặt hàng và kiểm tra tồn kho | Tạo đơn hàng từ giỏ hàng; kiểm tra và cập nhật số lượng còn hàng. Sau khi khách có phiên đăng nhập hợp lệ và xác nhận đặt đơn, hệ thống kiểm tra lại tồn kho của từng món trong giỏ. Nếu có món hết hàng hoặc số lượng còn lại không đủ, hệ thống chỉ rõ món cần điều chỉnh và giữ giỏ để khách sửa số lượng hoặc xóa món trước khi đặt lại. |
| MVP-07 | Thanh toán mô phỏng và giữ đơn | Thanh toán qua Ví điện tử hoặc Thẻ mô phỏng; nếu thanh toán thất bại, hệ thống giữ lại đơn hàng để khách hàng có thể thử thanh toán lại. |
| MVP-08 | Xác nhận đơn hàng | Hiển thị thông tin xác nhận, mã đơn hàng và chi tiết giao dịch sau khi xử lý đặt hàng và thanh toán thành công. |
| MVP-09 | Theo dõi trạng thái và hủy đơn | Khách hàng xem trạng thái hiện tại của đơn hàng thuộc tài khoản của mình. Khách hàng có thể hủy đơn ở trạng thái `Chờ thanh toán` và không có lần thanh toán `Đang xử lý`. Sau khi hủy thành công, đơn hiển thị trạng thái `Đã hủy` trong chi tiết và lịch sử đơn hàng. |
| MVP-10 | Lịch sử đơn hàng | Khách hàng xem lại danh sách và chi tiết các đơn hàng thuộc tài khoản của mình. |
| MVP-11 | Xử lý đơn tại quầy | Nhân viên quầy xem danh sách đơn đã xác nhận và cập nhật tiến độ theo thứ tự: `Đã xác nhận → Đang chuẩn bị → Sẵn sàng nhận → Hoàn tất`. |

### 3.2. Ngoài phạm vi MVP (Out-of-scope)

Các chức năng sau không thực hiện trong phạm vi MVP:

| Mã | Nội dung không thực hiện | Mô tả |
|---|---|---|
| OOS-01 | Thanh toán tiền thật | Không kết nối giao dịch tài chính thực tế với ngân hàng, thẻ tín dụng thật hoặc cổng thanh toán thương mại. |
| OOS-02 | Giao hàng tận nơi | Không hỗ trợ giao hàng; khách hàng nhận đồ uống tại quầy. Không xây dựng hệ thống quản lý tài xế, tính phí vận chuyển hoặc theo dõi lộ trình. |
| OOS-03 | Quản lý chuỗi nhiều chi nhánh | Không quản lý hoạt động của nhiều cửa hàng hoặc định tuyến đơn hàng theo chi nhánh. |
| OOS-04 | Chương trình khuyến mãi | Không áp dụng khuyến mãi, mã giảm giá trong MVP. |
| OOS-05 | Khách hàng thân thiết | Không tích điểm, đổi quà hay phân hạng thành viên trong MVP. |
| OOS-06 | Tích hợp hệ thống POS bên ngoài | Không tích hợp với phần mềm bán hàng hoặc kế toán của bên thứ ba. |
| OOS-07 | Ứng dụng di động native | Chỉ xây dựng ứng dụng web theo hướng mobile-first/PWA, không phát triển ứng dụng native riêng biệt cho iOS/Android. |
| OOS-08 | Hủy đơn đã thanh toán | Không cho phép khách hàng tự hủy đơn từ trạng thái `Đã xác nhận` trở đi, vì MVP không hỗ trợ hoàn tiền. |

---

## 4. Giả định (Assumptions)

Hệ thống được phân tích và thiết kế dựa trên các giả định sau:

| Mã | Giả định | Giải thích chi tiết |
|---|---|---|
| ASM-01 | Dữ liệu sản phẩm và tồn kho có sẵn | Cơ sở dữ liệu có sẵn dữ liệu khởi tạo (seed data) về đồ uống, giá bán, size, topping, số lượng tồn kho và tài khoản mẫu để phục vụ phát triển và kiểm thử. |
| ASM-02 | Quy mô một cửa hàng | Hệ thống vận hành cho một cửa hàng đồ uống duy nhất nhằm tập trung kiểm soát luồng đặt đơn, tồn kho và trạng thái đơn. |
| ASM-03 | Quy tắc tài khoản khách hàng | Khách hàng bắt buộc phải đăng nhập tài khoản hợp lệ để xem menu, chọn món, quản lý giỏ hàng, đặt đơn, thanh toán và truy cập lịch sử/trạng thái đơn hàng cá nhân. Khi chưa đăng nhập, khách chỉ có thể đăng ký hoặc đăng nhập. |
| ASM-04 | Dịch vụ thanh toán mô phỏng | Kết quả thanh toán (thành công hoặc thất bại) được tạo bởi dịch vụ Ví/Thẻ mô phỏng; đơn hàng thanh toán thất bại được giữ lại để hỗ trợ thử thanh toán lại. |
| ASM-05 | Chu trình trạng thái đơn hàng | Hệ thống kiểm soát chặt chẽ các trạng thái đơn hàng cố định (`Chờ thanh toán → Đã xác nhận → Đang chuẩn bị → Sẵn sàng nhận → Hoàn tất`) và trạng thái cuối `Đã hủy`; chỉ cho phép hủy đơn khi đơn còn `Chờ thanh toán`. |
| ASM-06 | Môi trường truy cập | Người dùng truy cập ứng dụng thông qua trình duyệt web trên thiết bị di động hoặc máy tính có kết nối Internet qua giao thức HTTPS. |
| ASM-07 | Tồn kho ban đầu | Mỗi món có số lượng tồn kho ban đầu được nạp từ dữ liệu mẫu (seed). Trong phạm vi MVP, hệ thống theo dõi số lượng còn bán được theo đơn hàng phát sinh. |

---

## 5. Ràng buộc (Constraints)

Hệ thống phải tuân theo các ràng buộc về công nghệ, tiến độ – quy trình và chất lượng sau. Nhóm có thể bổ sung các thư viện phụ trợ cho kiểm thử, xác thực và CI/CD nhưng tuyệt đối không được thay thế ba thành phần bắt buộc là Next.js, NestJS và PostgreSQL.

| Mã | Loại | Ràng buộc |
|---|---|---|
| CON-01 | Công nghệ | **Frontend:** Next.js, thiết kế theo hướng mobile-first/PWA. |
| CON-02 | Công nghệ | **Backend:** NestJS, tổ chức theo kiến trúc module/domain. |
| CON-03 | Công nghệ | **Database:** PostgreSQL, quản lý schema qua migration và dữ liệu mẫu qua seed. |
| CON-04 | Công nghệ | **Đóng gói và triển khai:** Docker (`docker-compose.yml` ở môi trường local và container image trên môi trường Production). |
| CON-05 | Công nghệ | **Thanh toán:** dịch vụ Ví/Thẻ mô phỏng trong phạm vi MVP. |
| CON-06 | Tiến độ và quy trình | Dự án thực hiện tuần tự qua 5 Task và triển khai mã nguồn trong 2 Sprint. |
| CON-07 | Tiến độ và quy trình | Kho mã nguồn theo cấu trúc `apps/web`, `apps/api`, `docs`, `tests`; mọi thay đổi tài liệu và mã nguồn đi qua Pull Request và có lịch sử commit rõ ràng. |
| CON-08 | Tiến độ và quy trình | Mọi Pull Request phải vượt qua pipeline CI (`Install → Lint → Unit Test → Build`) trước khi được merge. |
| CON-09 | Tiến độ và quy trình | Task tiếp theo chỉ được nghiệm thu khi toàn bộ tạo phẩm bắt buộc của Task trước đã có trên kho mã nguồn. |
| CON-10 | Chất lượng | API đạt thời gian phản hồi mục tiêu dưới 500 ms đối với bộ dữ liệu mẫu. |
| CON-11 | Chất lượng | Mật khẩu người dùng được băm (hash) trước khi lưu vào PostgreSQL; sử dụng JWT để xác thực và phân quyền truy cập. |
| CON-12 | Chất lượng | Kiểm tra tính hợp lệ của dữ liệu đầu vào (validation) ở cả Frontend và Backend. |
| CON-13 | Chất lượng | Sử dụng Database Transaction khi tạo đơn và trừ tồn kho; đảm bảo tính Idempotency khi xử lý yêu cầu thanh toán lặp lại. |
| CON-14 | Chất lượng | Giao diện hiển thị đầy đủ các trạng thái tải dữ liệu (`loading`), dữ liệu rỗng (`empty`) và thông báo lỗi (`error`). |

---

## 6. Rủi ro (Risks)

| Mã | Rủi ro | Ảnh hưởng | Hướng giảm thiểu |
|---|---|---|---|
| RSK-01 | Yêu cầu giữa các thành viên không thống nhất | Tài liệu Scope, SRS, Use-case và sơ đồ thiết kế bị lệch mã hoặc mâu thuẫn quy tắc nghiệp vụ. | Chốt 7 quy tắc nghiệp vụ ở Bước 1 trước khi viết; thực hiện đối chiếu chéo ở Bước 3 và lập ma trận truy vết (`traceability-matrix.md`). |
| RSK-02 | Phạm vi MVP bị mở rộng quá mức (Scope creep) | Nhóm không kịp hoàn thành kiểm thử và triển khai CI/CD trong 2 Sprint. | Giới hạn phạm vi ở 11 hạng mục MVP cốt lõi; đưa các tính năng phức tạp sang phạm vi mở rộng. |
| RSK-03 | Sai lệch tồn kho khi đặt đơn đồng thời | Số lượng còn hàng bị âm hoặc bán vượt số lượng thực tế khi có nhiều yêu cầu tạo đơn cùng lúc. | Thực hiện kiểm tra số lượng còn hàng và trừ tồn kho bên trong Database Transaction của PostgreSQL. |
| RSK-04 | Xử lý lỗi thanh toán hoặc thanh toán lại chưa chặt chẽ | Đơn hàng bị mất khi thanh toán lỗi hoặc bị ghi nhận trùng giao dịch khi khách bấm thử lại nhiều lần. | Giữ đơn ở trạng thái chờ thanh toán khi giao dịch thất bại và áp dụng cơ chế Idempotency cho API thanh toán. |
| RSK-05 | Xung đột trạng thái khi hủy đơn hoặc cập nhật đơn | Khách hàng hủy đơn đã thanh toán hoặc đang xử lý thanh toán, hoặc nhân viên cập nhật bỏ bước trạng thái. | Kiểm tra trạng thái đơn tại tầng Backend trước khi cập nhật; chỉ chấp nhận yêu cầu hủy đơn của chính khách hàng khi đơn đang `Chờ thanh toán` và không có lần thanh toán `Đang xử lý`; nếu hủy và bắt đầu thanh toán được gửi đồng thời thì chỉ chấp nhận một thao tác; từ chối nếu nhân viên cập nhật nhảy bước. |
| RSK-06 | Thiếu kiểm tra phân quyền và dữ liệu đầu vào | Khách hàng truy cập trái phép đơn hàng của tài khoản khác hoặc gửi dữ liệu không hợp lệ. | Xác thực JWT, kiểm tra quyền sở hữu mã đơn tại Backend và validate dữ liệu đầu vào ở cả client và server. |
| RSK-07 | Tài liệu và mã nguồn thực tế không đồng bộ | Sơ đồ thiết kế, đặc tả SRS và hành vi API thực tế không khớp nhau khi nghiệm thu. | Quản lý toàn bộ tài liệu trong thư mục `docs/` trên Git và cập nhật qua Pull Request mỗi khi có thay đổi. |

---

## 7. Định hướng phát triển mở rộng (Future & Extended Scope)

Sau khi hoàn thiện phạm vi MVP, hệ thống có thể mở rộng theo các hướng sau (một số thực thể nền tảng như `Promotion` và `LoyaltyTransaction` được định hình sẵn trong mô hình domain Class Diagram):

- Tích hợp chương trình khuyến mãi, mã giảm giá (`Promotion`) và tích điểm khách hàng thân thiết (`LoyaltyTransaction`).
- Tích hợp cổng thanh toán trực tuyến thực tế (VNPay, MoMo, thẻ ngân hàng).
- Xây dựng phân hệ quản lý giao hàng thời gian thực và tính phí vận chuyển tự động.
- Mở rộng kiến trúc hỗ trợ quản lý chuỗi nhiều cửa hàng/chi nhánh.
- Nâng cấp tính năng PWA (Push Notification thông báo trạng thái đơn, chế độ offline nâng cao).

---

## 8. Kết luận

Tài liệu `context-and-scope.md` xác lập ranh giới phạm vi, các bên liên quan, giả định, ràng buộc kỹ thuật và phương án kiểm soát rủi ro cho hệ thống BrewLite. Đây là cơ sở tham chiếu bắt buộc để nhóm xây dựng đặc tả yêu cầu phần mềm (`srs.md`), đặc tả Use-case trọng tâm (`use-case-checkout.md`), thiết kế kiến trúc và triển khai mã nguồn trong các giai đoạn tiếp theo.

---

## 9. Đối chiếu thống nhất với SRS

- Phạm vi **MVP-01 → MVP-05** đối chiếu với **FR-01 → FR-05, FR-12, FR-19 → FR-21** trong tài liệu `docs/requirements/srs.md`.
- Phạm vi **MVP-06 → MVP-08** đối chiếu với **FR-06, FR-07, FR-13 → FR-16, FR-18, FR-22** trong tài liệu `docs/requirements/srs.md`.
- Phạm vi **MVP-09 → MVP-10** đối chiếu với **FR-08, FR-23, FR-24** trong tài liệu `docs/requirements/srs.md`.
- Phạm vi **MVP-11** đối chiếu với **FR-09 → FR-10, FR-17** trong tài liệu `docs/requirements/srs.md`.
- **Các quy tắc nghiệp vụ cốt lõi đã thống nhất xuyên suốt tài liệu:**
  1. Quy mô triển khai: Một cửa hàng duy nhất.
  2. Yêu cầu tài khoản: Bắt buộc đăng nhập để xem menu, đặt đơn và theo dõi đơn hàng.
  3. Phương thức thanh toán: Thanh toán Ví/Thẻ mô phỏng.
  4. Quản lý hàng hóa: Theo dõi số lượng còn hàng (tồn kho) nạp từ dữ liệu mẫu; hệ thống tự giữ, chốt và giải phóng theo đơn.
  5. Xử lý thanh toán thất bại: Giữ lại đơn hàng để khách hàng thử thanh toán lại.
  6. Quy tắc hủy đơn: Chỉ cho phép khách hàng hủy đơn khi đơn còn Chờ thanh toán.
  7. Hình thức nhận đồ uống: Khách hàng nhận tại quầy; không hỗ trợ giao hàng.