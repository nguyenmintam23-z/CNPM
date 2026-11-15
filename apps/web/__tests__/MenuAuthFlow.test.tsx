import { render, screen, waitFor } from "@testing-library/react";
import Home from "../app/page";

// Kiểm thử toàn bộ trang chủ, bao gồm lớp phân quyền và menu khách hàng.
const mockReplace = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn(), refresh: jest.fn() }),
}));

const customerSession = {
  user: { role: "CUSTOMER" },
  role: "CUSTOMER",
};

function apiResponse(status: number, body: unknown = null) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
  };
}

describe("Trang chủ - xác thực và tải thực đơn", () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    fetchMock = jest.fn();
    global.fetch = fetchMock;
  });

  test("/auth/me trả 401: về đăng nhập và không tải sản phẩm", async () => {
    fetchMock.mockResolvedValue(apiResponse(401, { message: "Unauthorized" }));

    render(<Home />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/login?next=%2F");
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/me",
      expect.objectContaining({ credentials: "same-origin" }),
    );
    expect(screen.queryByText("Thực đơn BrewLite")).not.toBeInTheDocument();
  });

  test("Khách đăng nhập nhưng /products trả 401: về đăng nhập", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url === "/api/auth/me") return apiResponse(200, customerSession);
      if (url === "/api/products") return apiResponse(401, { message: "Unauthorized" });
      throw new Error(`Yêu cầu ngoài dự kiến: ${url}`);
    });

    render(<Home />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/products",
        expect.objectContaining({ credentials: "same-origin" }),
      );
    });
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/login?next=%2F");
    });
  });

  test("Khách đăng nhập và sản phẩm rỗng: hiển thị trạng thái rỗng", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url === "/api/auth/me") return apiResponse(200, customerSession);
      if (url === "/api/products") return apiResponse(200, []);
      throw new Error(`Yêu cầu ngoài dự kiến: ${url}`);
    });

    render(<Home />);

    expect(
      await screen.findByRole("heading", {
        name: "Thực đơn đang được chuẩn bị",
      }),
    ).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
