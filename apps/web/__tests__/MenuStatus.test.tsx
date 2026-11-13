
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MenuStatus from "../components/menu/MenuStatus";

describe("MenuStatus", () => {
  test("Hiển thị trạng thái loading", () => {
    render(<MenuStatus status="loading" />);

    expect(
      screen.getByText("Đang tải menu...")
    ).toBeInTheDocument();
  });

  test("Hiển thị trạng thái empty", () => {
    render(<MenuStatus status="empty" />);

    expect(
      screen.getByText("Hiện chưa có sản phẩm.")
    ).toBeInTheDocument();
  });

  test("Hiển thị trạng thái error", () => {
    render(<MenuStatus status="error" />);

    expect(
      screen.getByText("Không thể tải menu.")
    ).toBeInTheDocument();
  });

  test("Nhấn thử lại gọi hàm onRetry", async () => {
    const user = userEvent.setup();
    const onRetry = jest.fn();

    render(
      <MenuStatus
        status="error"
        onRetry={onRetry}
      />
    );

    await user.click(
      screen.getByRole("button", { name: "Thử lại" })
    );

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
