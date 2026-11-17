package com.diza.api.ml;

import com.diza.api.common.ApiResponse;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class MlExceptionHandler {

    @ExceptionHandler(MlServiceException.class)
    @ResponseStatus(HttpStatus.BAD_GATEWAY)
    ApiResponse<Void> handleMlServiceException(MlServiceException exception) {
        return ApiResponse.error(exception.getMessage());
    }
}
