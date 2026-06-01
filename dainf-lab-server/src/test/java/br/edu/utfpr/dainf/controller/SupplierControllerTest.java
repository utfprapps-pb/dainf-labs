package br.edu.utfpr.dainf.controller;

import br.edu.utfpr.dainf.dto.FornecedorDTO;
import br.edu.utfpr.dainf.enums.UnidadeFederativa;
import br.edu.utfpr.dainf.shared.CrudControllerTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class SupplierControllerTest extends CrudControllerTest<FornecedorDTO> {

    @BeforeEach
    protected void setUp() {
    }

    @Override
    protected String getURL() {
        return "/fornecedores";
    }

    @Override
    protected FornecedorDTO createValidObject() {
        return new FornecedorDTO(null, "Fornecedor Teste", "Razão Social Teste", "35258347000113",
                "Rua Teste", "123", "Bairro Teste", "teste@gmail.com", "46999998888", "Pato Branco", UnidadeFederativa.PR);
    }

    @Override
    protected FornecedorDTO createInvalidObject() {
        return new FornecedorDTO(null, "Fornecedor Inválido", "Razão Social Inválida", "352583000113", // Invalid CNPJ
                "Rua Teste", "123", "Bairro Teste", "teste@gmail.com", "46999998888", "Pato Branco", UnidadeFederativa.PR);
    }

    @Override
    protected void onBeforeUpdate(FornecedorDTO dto) {
        dto.setNomeFantasia("Fornecedor Teste Alterado");
    }

    @Test
    void createWithNullRazaoSocial_returns400() throws Exception {
        FornecedorDTO dto = new FornecedorDTO(null, null, "Razão Social Teste", "35258347000113",
                "Rua Teste", null, null, "teste@gmail.com", "46999998888", "Pato Branco", UnidadeFederativa.PR);
        performCreate(dto).andExpect(status().isBadRequest());
    }

    @Test
    void createWithNullNomeFantasia_returns400() throws Exception {
        FornecedorDTO dto = new FornecedorDTO(null, "Fornecedor Teste", null, "35258347000113",
                "Rua Teste", null, null, "teste@gmail.com", "46999998888", "Pato Branco", UnidadeFederativa.PR);
        performCreate(dto).andExpect(status().isBadRequest());
    }

    @Test
    void createWithInvalidEmail_returns400() throws Exception {
        FornecedorDTO dto = new FornecedorDTO(null, "Fornecedor Teste", "Razão Social Teste", "35258347000113",
                "Rua Teste", null, null, "email-invalido", "46999998888", "Pato Branco", UnidadeFederativa.PR);
        performCreate(dto).andExpect(status().isBadRequest());
    }

    @Test
    void createWithNullEstado_returns400() throws Exception {
        FornecedorDTO dto = new FornecedorDTO(null, "Fornecedor Teste", "Razão Social Teste", "35258347000113",
                "Rua Teste", null, null, "teste@gmail.com", "46999998888", "Pato Branco", null);
        performCreate(dto).andExpect(status().isBadRequest());
    }

    @Test
    void createWithRazaoSocialExceedingMaxLength_returns400() throws Exception {
        FornecedorDTO dto = new FornecedorDTO(null, "R".repeat(81), "Razão Social Teste", "35258347000113",
                null, "Rua Teste", null, "teste@gmail.com", "46999998888", "Pato Branco", UnidadeFederativa.PR);
        performCreate(dto).andExpect(status().isBadRequest());
    }

    @Test
    void createWithEnderecoExceedingMaxLength_returns400() throws Exception {
        FornecedorDTO dto = new FornecedorDTO(null, "Fornecedor Teste", "Razão Social Teste", "35258347000113",
                null, "R".repeat(101), null, "teste@gmail.com", "46999998888", "Pato Branco", UnidadeFederativa.PR);
        performCreate(dto).andExpect(status().isBadRequest());
    }
}
